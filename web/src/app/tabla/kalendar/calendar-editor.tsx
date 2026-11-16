"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { SameDayToggle } from "@/components/schedule-week";
import { daysSince, isoWeekday, startOfWeekISO, todayISO, WEEKDAYS } from "@/lib/format";
import {
  add,
  complement,
  endMin,
  fromRows,
  normalize,
  rowOk,
  subtract,
  summary,
  toMin,
  toRows,
  toTime,
  type Interval,
  type Row,
} from "@/lib/intervals";
import { SCHEDULE_PRESETS } from "@/lib/schedule-presets";
import { RowList, SlotChips } from "./interval-editor";
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
  const todayNote = todayNotFree
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

  return (
    <div className="grid min-w-0 gap-10">
      <div>
        <Title className="display text-5xl sm:text-6xl">Календар</Title>
        <p className="mt-2 max-w-2xl text-lg text-ink-2">{TITLE_LINE}</p>
      </div>

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
      {initialRules.length > 0 && <ConfirmField k={k} />}

      <section aria-labelledby="schedule-h" className="grid min-w-0 gap-4">
        <h2 id="schedule-h" className="display text-3xl sm:text-4xl">
          Редовен график
        </h2>
        <ScheduleEditor userId={userId} initialRules={initialRules} onSaved={refresh} />
      </section>

      <DaySheet k={k} />
      <VacationDialog k={k} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Weekly recurring schedule
// ---------------------------------------------------------------------------
function ScheduleEditor({ userId, initialRules, onSaved }: { userId: string; initialRules: Rule[]; onSaved: () => Promise<void> }) {
  const supabase = createClient();
  const initial = useMemo(() => {
    const m: Interval[][] = Array.from({ length: 7 }, () => []);
    for (const r of initialRules) m[r.weekday - 1] = add(m[r.weekday - 1], [toMin(r.start_time), endMin(r.end_time)]);
    return m;
  }, [initialRules]);
  const [week, setWeek] = useState<Row[][]>(() => initial.map(toRows));
  const [custom, setCustom] = useState<number | null>(null);
  const [saving, start] = useTransition();
  const lists = week.map(fromRows);
  const invalid = week.some((rows) => rows.some((r) => !rowOk(r)));
  const dirty = invalid || JSON.stringify(lists) !== JSON.stringify(initial);

  const setDayRows = (i: number, rows: Row[]) => setWeek((w) => w.map((d, k) => (k === i ? rows : d)));
  const preset = (fn: (wd: number) => Interval[]) => setWeek(Array.from({ length: 7 }, (_, i) => toRows(normalize(fn(i + 1)))));
  const copyToWeekdays = (i: number) => setWeek((w) => w.map((d, k) => (k < 5 && k !== i ? toRows(fromRows(w[i])) : d)));

  function save() {
    if (invalid) return void toast.error("Има интервал, в който краят е преди началото.");
    start(async () => {
      const rows = lists.flatMap((list, i) =>
        list.map(([a, b]) => ({ craftsman_id: userId, weekday: i + 1, start_time: toTime(a), end_time: b >= 1440 ? "24:00" : toTime(b) })),
      );
      const del = await supabase.from("availability_rules").delete().eq("craftsman_id", userId);
      if (del.error) return void toast.error("Графикът не беше записан.");
      if (rows.length) {
        const ins = await supabase.from("availability_rules").insert(rows);
        if (ins.error) return void toast.error("Графикът не беше записан.");
      }
      setWeek(lists.map(toRows));
      await onSaved();
      toast.success("Редовният график е записан.");
    });
  }

  return (
    <div className="grid gap-5">
      <p className="text-ink-2">
        Кои дни и часове обикновено работиш. В един ден може да има няколко интервала, напр. 08–12 и 15–19. Отделни дни
        и отпуски променяш от „Месец“ или с бързите бутони горе.
      </p>
      <div className="flex flex-wrap gap-2">
        <span className="self-center text-sm font-bold">Бързо:</span>
        {SCHEDULE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="chip"
            onClick={() =>
              preset((d) =>
                p.rules.filter((r) => r.weekday === d).map((r): Interval => [toMin(r.start_time), toMin(r.end_time)]),
              )
            }
          >
            {p.label}
          </button>
        ))}
        <button type="button" className="chip" onClick={() => preset(() => [])}>
          Изчисти
        </button>
      </div>

      <ul className="grid">
        {week.map((rows, i) => (
          <li key={i} className="py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="w-28 shrink-0">
                <p className="font-extrabold capitalize">{WEEKDAYS[i]}</p>
                <p className="text-sm text-ink-3">{summary(lists[i])}</p>
              </div>
              <div className="flex flex-1 flex-wrap gap-2">
                <SlotChips rows={rows} onChange={(r) => setDayRows(i, r)} label={WEEKDAYS[i]} />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm underline underline-offset-4"
                  aria-expanded={custom === i}
                  onClick={() => setCustom(custom === i ? null : i)}
                >
                  Точни часове
                </button>
              </div>
            </div>
            {custom === i && (
              <div className="mt-3 grid gap-3 rounded-[8px] bg-surface-2 p-3">
                <RowList rows={rows} onChange={(r) => setDayRows(i, r)} idPrefix={`s${i}`} />
                {i < 5 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm justify-self-start underline underline-offset-4"
                    onClick={() => copyToWeekdays(i)}
                  >
                    Същите часове за всички делнични дни
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {!dirty ? (
        <p className="text-sm text-ink-3">Графикът е записан. Промените се виждат веднага в профила ти.</p>
      ) : (
        <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-[10px] bg-ink p-3 max-lg:bottom-[calc(4.25rem+env(safe-area-inset-bottom))] text-white shadow-[var(--shadow-lg)]">
          <p className="flex-1 pl-1 text-sm">
            {invalid ? "Поправи часовете, в които краят е преди началото." : "Имате незаписани промени."}
          </p>
          <button type="button" className="btn text-white hover:bg-white/10" disabled={saving} onClick={() => setWeek(initial.map(toRows))}>
            Откажи
          </button>
          <button type="button" className="btn btn-rule" disabled={saving || invalid} onClick={save}>
            {saving ? "Записваме…" : "Запази графика"}
          </button>
        </div>
      )}
    </div>
  );
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
