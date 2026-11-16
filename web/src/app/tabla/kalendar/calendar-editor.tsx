"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { FirstScheduleFrame, SameDayToggle, ScheduleSection, ScheduleWeek, useWeekDraft } from "@/components/schedule-week";
import { daysSince, isoWeekday, startOfWeekISO, todayISO } from "@/lib/format";
import { add, complement, endMin, normalize, subtract, toMin, toTime, type Interval } from "@/lib/intervals";
import { rulesToWeek, weekToRules, type Week } from "@/lib/schedule-presets";
import {
  BookingsBox,
  BusyPeriods,
  ConfirmField,
  DaySheet,
  Meter,
  MonthGrid,
  QuickActions,
  REASON_OFF,
  REASON_SHORT,
  VacationDialog,
  WeekView,
  type DayInfo,
  type Kalendar,
  type Period,
} from "./calendar-parts";

type Rule = { id: string; weekday: number; start_time: string; end_time: string };
type Exception = {
  id: string;
  kind: "free" | "busy";
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  created_at: string;
};
type Day = { day: string; status: "free" | "partial" | "busy"; free_hours: number; ranges: { start: string; end: string }[] };

/** An agreed or proposed visit from a chat, or a planned job of the craftsman */
export type Visit = {
  id: string;
  date: string;
  endDate: string | null;
  start: string | null;
  end: string | null;
  kind: "confirmed" | "proposed" | "job";
  title: string;
  who: string;
  href: string;
};

type Props = {
  userId: string;
  /** a manager editing the calendar of a craftsman in his company */
  managing?: boolean;
  initialRules: Rule[];
  initialExceptions: Exception[];
  initialDays: Day[];
  shortNotice: boolean;
  lastConfirmedAt: string;
  /** [] when managing */
  visits: Visit[];
  /** minutes from 00:00 by the database clock (sofia_now) */
  nowMin: number;
};

const TITLE_LINE = "Клиентите виждат кога си свободен. Календарът е ориентировъчен: датата се потвърждава в чата.";

export function CalendarEditor({
  userId,
  managing = false,
  initialRules,
  initialExceptions,
  initialDays,
  shortNotice,
  lastConfirmedAt,
  visits,
  nowMin,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [today] = useState(todayISO);
  const [exceptions, setExceptions] = useState(initialExceptions);
  const [days, setDays] = useState(initialDays);
  const [view, setView] = useState<"month" | "week">("month");
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [vacationOpen, setVacationOpen] = useState(false);
  const [busy, startBusy] = useTransition();
  const [notice, setNotice] = useState(shortNotice);
  const [daysAgo, setDaysAgo] = useState(() => daysSince(lastConfirmedAt));
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  // Stable by content: a refresh brings a new array every time, and a new `saved` would reset the unsaved first schedule
  const rulesKey = JSON.stringify(initialRules.map((r) => [r.weekday, r.start_time, r.end_time]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saved = useMemo(() => rulesToWeek(initialRules), [rulesKey]);
  const savingWeek = useRef(false);
  const hasSchedule = initialRules.length > 0;

  const refresh = useCallback(async () => {
    const [{ data: d }, { data: ex }] = await Promise.all([
      supabase.rpc("availability_days", { p_craftsman: userId, p_from: today, p_days: 70 }),
      supabase
        .from("availability_exceptions")
        .select("id, kind, start_date, end_date, start_time, end_time, note, created_at")
        .eq("craftsman_id", userId)
        .gte("end_date", today)
        .order("start_date"),
    ]);
    if (d) setDays(d as Day[]);
    if (ex) setExceptions(ex as Exception[]);
    router.refresh();
  }, [supabase, userId, today, router]);

  const run = (fn: () => Promise<string | void>) =>
    startBusy(async () => {
      try {
        const msg = await fn();
        await refresh();
        if (msg) toast.success(msg);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Не успяхме да запишем промяната.");
      }
    });

  async function check<T extends { error: { message: string } | null }>(p: PromiseLike<T>) {
    const res = await p;
    if (res.error) throw new Error("Промяната не беше записана. Опитайте отново.");
    return res;
  }

  // -------------------------------------------------------------- actions
  function busyRange(from: string, to: string, note: string, label: string) {
    run(async () => {
      await check(
        supabase.from("availability_exceptions").insert({
          craftsman_id: userId,
          kind: "busy",
          start_date: from,
          end_date: to,
          note,
        }),
      );
      return label;
    });
  }

  function setDay(date: string, mode: "free" | "busy" | "reset") {
    run(async () => {
      await clearDay(date);
      const base = { craftsman_id: userId, start_date: date, end_date: date };
      if (mode === "free") await check(supabase.from("availability_exceptions").insert({ ...base, kind: "free", note: "Свободен" }));
      if (mode === "busy") await check(supabase.from("availability_exceptions").insert({ ...base, kind: "busy", note: "Зает" }));
      setOpenDay(null);
      return mode === "reset" ? "Денят е върнат по графика." : "Денят е обновен.";
    });
  }

  /** Make the day free exactly in `list`: free rows for each interval, busy rows for the gaps. */
  function saveDay(date: string, list: Interval[]) {
    run(async () => {
      await clearDay(date);
      const others = exceptions.filter((e) => !(e.start_date === date && e.end_date === date));
      const same = JSON.stringify(planFor(date, initialRules, others)) === JSON.stringify(list);
      if (!same) {
        const base = { craftsman_id: userId, start_date: date, end_date: date };
        const t = (m: number) => (m >= 24 * 60 ? "24:00" : toTime(m));
        const rows = [
          ...list.map(([a, b]) => ({ ...base, kind: "free" as const, start_time: t(a), end_time: t(b), note: "Свободен" })),
          ...complement(list).map(([a, b]) => ({ ...base, kind: "busy" as const, start_time: t(a), end_time: t(b), note: "Зает" })),
        ];
        await check(supabase.from("availability_exceptions").insert(rows));
      }
      setOpenDay(null);
      return same ? "Денят е по редовния график." : "Часовете за деня са записани.";
    });
  }

  async function clearDay(date: string) {
    await check(
      supabase.from("availability_exceptions").delete().eq("craftsman_id", userId).eq("start_date", date).eq("end_date", date),
    );
  }

  function removeException(id: string) {
    run(async () => {
      await check(supabase.from("availability_exceptions").delete().eq("id", id));
      return "Премахнато.";
    });
  }

  /** Replace the regular schedule with `week`; `msg.undo` offers „Върни“ with the earlier week */
  function saveWeek(week: Week, msg?: { text: string; undo?: Week }) {
    // two overlapping delete-and-insert runs could leave duplicate rows
    if (savingWeek.current) return;
    savingWeek.current = true;
    startBusy(async () => {
      try {
        const rows = weekToRules(week).map((r) => ({ craftsman_id: userId, ...r }));
        const del = await supabase.from("availability_rules").delete().eq("craftsman_id", userId);
        if (del.error) return void toast.error("Графикът не беше записан.");
        if (rows.length) {
          const ins = await supabase.from("availability_rules").insert(rows);
          if (ins.error) {
            // the old rules are already deleted: show what the database really holds
            await refresh();
            return void toast.error("Графикът не беше записан.");
          }
        }
        await refresh();
        const undo = msg?.undo;
        toast.success(
          msg?.text ?? "Редовният график е записан.",
          undo ? { action: { label: "Върни", onClick: () => saveWeek(undo, { text: "Графикът е върнат." }) } } : undefined,
        );
      } catch {
        toast.error("Графикът не беше записан.");
      } finally {
        savingWeek.current = false;
      }
    });
  }

  function toggleNotice(v: boolean) {
    setNotice(v);
    startBusy(async () => {
      const { error } = await supabase.from("craftsman_profiles").update({ short_notice: v }).eq("id", userId);
      if (error) {
        setNotice(!v);
        toast.error("Не успяхме да запишем промяната.");
        return;
      }
      // today's state depends on the switch
      await refresh();
      toast.success(v ? "Вече излизаш и „Свободен днес“." : "Вече не излизаш „Свободен днес“.");
    });
  }

  // -------------------------------------------------------------- derived
  const weekStart = startOfWeekISO(today);
  const periods: Period[] = exceptions
    .filter((e) => e.start_date !== e.end_date || (e.kind === "busy" && !e.start_time && e.note === "Отпуск"))
    .map((e) => ({ id: e.id, from: e.start_date, to: e.end_date, note: e.note ?? (e.kind === "busy" ? "Зает" : "Свободен") }));
  const periodsOn = (iso: string): Period[] =>
    exceptions
      .filter((e) => e.start_date !== e.end_date && e.start_date <= iso && e.end_date >= iso)
      .map((e) => ({ id: e.id, from: e.start_date, to: e.end_date, note: e.note ?? "Зает" }));

  const visitsOn = (iso: string) =>
    visits
      .filter((v) => v.date <= iso && iso <= (v.endDate ?? v.date))
      .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  // a visit of today that is over by the database clock is not „upcoming“
  const upcoming = visits
    .filter((v) => !(v.date === today && !v.endDate && v.end && endMin(v.end) <= nowMin))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? ""))
    .slice(0, 20);

  const plan = (iso: string) => planFor(iso, initialRules, exceptions);
  // Today is not „Свободен днес“: a working day by the schedule, but the database offers no hours
  const todayDb = byDay.get(today);
  const todayNotFree = todayDb !== undefined && todayDb.ranges.length === 0 && plan(today).length > 0;
  const todayNote = todayNotFree && !managing
    ? notice
      ? { reason: "short" as const, text: REASON_SHORT }
      : { reason: "off" as const, text: REASON_OFF }
    : null;

  const dayInfo = (iso: string): DayInfo => {
    const d = byDay.get(iso);
    const isToday = iso === today;
    const notToday = isToday && todayNotFree;
    const soft = notToday
      ? visitsOn(iso)
          .filter((v) => v.kind !== "proposed")
          .reduce((list, v) => subtract(list, [v.start ? toMin(v.start) : 0, v.end ? endMin(v.end) : 1440]), plan(iso))
      : [];
    return {
      iso,
      past: iso < today,
      far: !d,
      isToday,
      ranges: (d?.ranges ?? []).map((r): Interval => [toMin(r.start), endMin(r.end)]),
      status: notToday ? "busy" : (d?.status ?? "busy"),
      manual: exceptions.some((e) => e.start_date === iso && e.end_date === iso),
      notToday,
      soft,
    };
  };

  const k: Kalendar = {
    userId,
    today,
    nowMin,
    weekStart,
    busy,
    shortNotice: notice,
    daysAgo,
    openDay,
    setOpenDay,
    vacationOpen,
    setVacationOpen,
    periods,
    periodsOn,
    upcoming,
    visitsOn,
    planFor: plan,
    dayInfo,
    todayNote,
    busyRange,
    setDay,
    saveDay,
    removePeriod: removeException,
    onConfirmed: () => setDaysAgo(0),
  };

  const Title = managing ? "h2" : "h1";

  const title = (
    <div>
      <Title className="display text-5xl sm:text-6xl">Календар</Title>
      <p className="mt-2 max-w-2xl text-lg text-ink-2">{TITLE_LINE}</p>
    </div>
  );

  // A craftsman without a single rule: only the first schedule, in place of the whole calendar
  if (!hasSchedule) {
    return (
      <div className="grid min-w-0 gap-10">
        {title}
        <ScheduleBlock
          key="first"
          saved={saved}
          first
          saveWeek={saveWeek}
          sameDay={!managing && <SameDayToggle on={notice} onChange={toggleNotice} disabled={busy} />}
        />
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-10">
      {title}

      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="grid min-w-0 gap-5">
          <Meter k={k} />

          {!managing && todayNote && (
            <p className="rounded-[10px] bg-rule-soft px-4 py-3 text-[0.95rem]">
              Днес вече не излизаш свободен ({todayNote.text}). За клиентите си свободен от утре.
            </p>
          )}

          <div role="tablist" aria-label="Изглед" className="flex gap-1">
            {(
              [
                ["month", "Месец"],
                ["week", "Седмица"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={`min-h-11 rounded-[6px] px-6 font-bold ${view === key ? "bg-rule text-ink" : "bg-surface text-ink-2"}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-w-0">{view === "month" ? <MonthGrid k={k} marks={!managing} /> : <WeekView k={k} />}</div>
        </div>

        <aside className="grid min-w-0 gap-4" aria-label={managing ? "Бързи действия" : "Уговорено и бързи действия"}>
          {!managing && <BookingsBox k={k} />}
          <QuickActions k={k} />
          {!managing && <SameDayToggle on={notice} onChange={toggleNotice} disabled={busy} />}
        </aside>
      </div>

      <BusyPeriods k={k} />
      <ConfirmField k={k} />

      <ScheduleBlock key="saved" saved={saved} first={false} saveWeek={saveWeek} />

      <DaySheet k={k} />
      <VacationDialog k={k} />
    </div>
  );
}

/** „Редовен график“ (a saved schedule) or the first schedule of a new craftsman; its draft restarts when the first one is saved */
function ScheduleBlock({
  saved,
  first,
  saveWeek,
  sameDay,
}: {
  saved: Week;
  first: boolean;
  saveWeek: (week: Week, msg?: { text: string; undo: Week }) => void;
  sameDay?: ReactNode;
}) {
  const d = useWeekDraft({ saved, first, saveWeek });
  const week = <ScheduleWeek d={d} first={first} tone={first ? "bg-surface" : "bg-paper"} />;
  if (first) {
    return (
      <FirstScheduleFrame onSave={d.save} sameDay={sameDay}>
        {week}
      </FirstScheduleFrame>
    );
  }
  return <ScheduleSection help="Докосни ден, за да промениш часовете му.">{week}</ScheduleSection>;
}

/**
 * The day's availability from weekly rules and exceptions, before bookings. Same formula as
 * `day_free_ranges` in the database: the newer edit wins between the day's own exceptions and a longer period.
 */
function planFor(date: string, rules: Rule[], exceptions: Exception[]): Interval[] {
  const wd = isoWeekday(date);
  let list = normalize(rules.filter((r) => r.weekday === wd).map((r) => [toMin(r.start_time), endMin(r.end_time)] as Interval));
  const all = exceptions.filter((e) => e.start_date <= date && e.end_date >= date);
  const newest = (xs: Exception[]) => xs.reduce((m, e) => (e.created_at > m ? e.created_at : m), "");
  const singles = all.filter((e) => e.start_date === e.end_date);
  const periods = all.filter((e) => e.start_date !== e.end_date);
  const cover = singles.length && newest(singles) > newest(periods) ? singles : all;
  for (const e of cover)
    if (e.kind === "free") list = add(list, e.start_time && e.end_time ? [toMin(e.start_time), endMin(e.end_time)] : [480, 1200]);
  for (const e of cover)
    if (e.kind === "busy") list = e.start_time && e.end_time ? subtract(list, [toMin(e.start_time), endMin(e.end_time)]) : [];
  return list;
}
