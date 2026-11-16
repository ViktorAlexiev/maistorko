"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CalendarCheck, CalendarOff, ChevronLeft, ChevronRight, Palmtree, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { RowList, SlotChips } from "@/app/tabla/kalendar/interval-editor";
import { DateField } from "@/components/date-time-fields";
import { addDaysISO, formatDate, isoWeekday, MONTHS_SHORT, parseISO, startOfWeekISO, WEEKDAYS_SHORT } from "@/lib/format";
import {
  add,
  fromRows,
  normalize,
  rowOk,
  subtract,
  toMin,
  toRows,
  toTime,
  totalHours,
  type Interval,
  type Row,
} from "@/lib/intervals";
import { SCHEDULE_PRESETS, type SchedulePreset } from "@/lib/schedule-presets";

// ---------------------------------------------------------------------------
// Types and small helpers
// ---------------------------------------------------------------------------
export type Status = "free" | "partial" | "busy";
export type BookingKind = "confirmed" | "proposed" | "job";
export type Booking = {
  id: string;
  date: string;
  start: number;
  end: number;
  title: string;
  /** the client's name, or „записана от теб“ for a planned job */
  who: string;
  kind: BookingKind;
  href: string;
};
export type Period = { id: string; from: string; to: string; note: string; at: number };
type Edit = { list: Interval[]; at: number };

export type DayInfo = {
  iso: string;
  past: boolean;
  isToday: boolean;
  /** free intervals after the schedule, manual change, periods, confirmed bookings and jobs */
  ranges: Interval[];
  status: Status;
  /** the day was changed by hand */
  manual: boolean;
  /** a plain day off by the weekly schedule */
  off: boolean;
  /** today, with some working time left, but not shown as „Свободен днес“ */
  notToday: boolean;
};

export const STATUS_WORD: Record<BookingKind, string> = {
  confirmed: "потвърдено",
  proposed: "чака отговор",
  job: "поръчка",
};

const sh = (m: number) => (m % 60 === 0 ? String(m / 60).padStart(2, "0") : toTime(m));
/** "08–18" for the small month cells */
export const shortHours = (list: Interval[]) => list.map(([a, b]) => `${sh(a)}–${sh(b)}`).join(", ");
/** "08:00–18:00" */
export const fullRange = (a: number, b: number) => `${toTime(a)}–${b >= 1440 ? "24:00" : toTime(b)}`;
export const fullHours = (list: Interval[]) => list.map(([a, b]) => fullRange(a, b)).join(", ");

const DEMO_RULES: Interval[][] = [
  [[480, 1080]],
  [[480, 1080]],
  [[480, 1080]],
  [[480, 1080]],
  [[480, 1080]],
  [[540, 780]],
  [],
];
const emptyWeek = (): Interval[][] => Array.from({ length: 7 }, () => []);

const REASON_SHORT = "остава по-малко от 2 часа";
const REASON_OFF = "без отметката „Мога да дойда и в същия ден“";

// ---------------------------------------------------------------------------
// State: everything is local, nothing is saved
// ---------------------------------------------------------------------------
export function useKalendar({ today, chas, nov }: { today: string; chas: string; nov: boolean }) {
  const nowMin = toMin(chas);
  const weekStart = startOfWeekISO(today);
  const seq = useRef(10);

  const [rules, setRules] = useState<Interval[][]>(() => (nov ? emptyWeek() : DEMO_RULES.map((l) => l.map((iv) => [...iv] as Interval))));
  const [hasSchedule, setHasSchedule] = useState(!nov);
  const [periods, setPeriods] = useState<Period[]>(() =>
    nov ? [] : [{ id: "p1", from: addDaysISO(today, 19), to: addDaysISO(today, 23), note: "Отпуск", at: 1 }],
  );
  const [edits, setEdits] = useState<Record<string, Edit>>(() => (nov ? {} : { [addDaysISO(today, 3)]: { list: [[480, 720]], at: 2 } }));
  const [shortNotice, setShortNotice] = useState(true);
  const [daysAgo, setDaysAgo] = useState(3);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [vacationOpen, setVacationOpen] = useState(false);

  const bookings = useMemo<Booking[]>(() => {
    if (nov) return [];
    const d = (n: number) => addDaysISO(today, n);
    return [
      { id: "b0", date: today, start: 510, end: 600, title: "Монтаж на ключ", who: "Иван Стоянов", kind: "confirmed", href: "/saobshtenia/demo-3" },
      { id: "b1", date: d(2), start: 600, end: 720, title: "Смяна на смесител", who: "Мария Иванова", kind: "confirmed", href: "/saobshtenia/demo-1" },
      { id: "b2", date: d(4), start: 840, end: 960, title: "Оглед на баня", who: "Петър Колев", kind: "proposed", href: "/saobshtenia/demo-2" },
      { id: "b3", date: d(8), start: 480, end: 1020, title: "Ремонт на ел. табло", who: "записана от теб", kind: "job", href: "/tabla/porachki" },
    ];
  }, [nov, today]);

  // ---- derived
  const periodsOn = (iso: string) => periods.filter((p) => p.from <= iso && p.to >= iso);
  const weekRule = (iso: string) => rules[isoWeekday(iso) - 1];
  /** What the day offers before bookings. A manual change wins over a period only if it is newer (as in the real calendar). */
  const planFor = (iso: string): Interval[] => {
    const cov = periodsOn(iso);
    const edit = edits[iso];
    if (edit && cov.every((p) => p.at < edit.at)) return edit.list;
    if (cov.length) return [];
    return weekRule(iso);
  };
  const basePlan = (iso: string): Interval[] => (periodsOn(iso).length ? [] : weekRule(iso));
  const bookingsOn = (iso: string) => bookings.filter((b) => b.date === iso).sort((a, b) => a.start - b.start);
  /** Proposed bookings do not subtract */
  const freeOf = (iso: string) =>
    bookingsOn(iso)
      .filter((b) => b.kind !== "proposed")
      .reduce((list, b) => subtract(list, [b.start, b.end]), planFor(iso));

  // Today rule: „Свободен днес“ needs the checkbox and at least 2 hours left from the next half hour
  const fromMin = Math.ceil(nowMin / 30) * 30;
  const todayRanges = freeOf(today);
  const leftHours = totalHours(todayRanges.map(([a, b]) => [Math.max(a, fromMin), b] as Interval).filter(([a, b]) => b > a));
  const todayFree = shortNotice && leftHours >= 2;
  const todayNote =
    !todayFree && todayRanges.length > 0
      ? { reason: shortNotice ? ("short" as const) : ("off" as const), text: shortNotice ? REASON_SHORT : REASON_OFF }
      : null;

  const dayInfo = (iso: string): DayInfo => {
    const ranges = freeOf(iso);
    const h = totalHours(ranges);
    const notToday = iso === today && todayNote !== null;
    const status: Status = notToday ? "busy" : h >= 4 ? "free" : h > 0 ? "partial" : "busy";
    return {
      iso,
      past: iso < today,
      isToday: iso === today,
      ranges,
      status,
      manual: Boolean(edits[iso]),
      off: weekRule(iso).length === 0 && !edits[iso] && periodsOn(iso).length === 0,
      notToday,
    };
  };

  // ---- actions (each gives the toast the real page gives)
  const busyRange = (from: string, to: string, note: string, label: string) => {
    const at = ++seq.current;
    setPeriods((p) => [...p, { id: `p${at}`, from, to, note, at }]);
    toast.success(label);
  };
  const setDay = (date: string, mode: "free" | "busy" | "reset") => {
    const at = ++seq.current;
    setEdits((e) => {
      const next = { ...e };
      if (mode === "reset") delete next[date];
      else next[date] = { list: mode === "free" ? add(weekRule(date), [480, 1200]) : [], at };
      return next;
    });
    setOpenDay(null);
    toast.success(mode === "reset" ? "Денят е върнат по графика." : "Денят е обновен.");
  };
  const saveDay = (date: string, list: Interval[]) => {
    const same = JSON.stringify(basePlan(date)) === JSON.stringify(list);
    const at = ++seq.current;
    setEdits((e) => {
      const next = { ...e };
      if (same) delete next[date];
      else next[date] = { list, at };
      return next;
    });
    setOpenDay(null);
    toast.success(same ? "Денят е по редовния график." : "Часовете за деня са записани.");
  };
  const removePeriod = (id: string) => {
    setPeriods((p) => p.filter((x) => x.id !== id));
    toast.success("Премахнато.");
  };
  const toggleNotice = (v: boolean) => {
    setShortNotice(v);
    toast.success(v ? "Вече излизаш и „Свободен днес“." : "Вече не излизаш „Свободен днес“.");
  };
  /** Saves the weekly schedule; with `undo` the message offers „Върни“, which saves those rules back */
  const saveRules = (lists: Interval[][], opts?: { text?: string; undo?: Interval[][] }) => {
    setRules(lists);
    setHasSchedule(true);
    const undo = opts?.undo;
    toast.success(
      opts?.text ?? "Редовният график е записан.",
      undo && {
        action: {
          label: "Върни",
          onClick: () => {
            setRules(undo);
            toast.success("Графикът е върнат.");
          },
        },
      },
    );
  };
  const confirm = () => {
    setDaysAgo(0);
    toast.success("Графикът е потвърден. Клиентите виждат, че е актуален.");
  };

  const upcoming = bookings
    .filter((b) => b.date > today || (b.date === today && b.end > nowMin))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);

  return {
    today,
    nowMin,
    weekStart,
    rules,
    hasSchedule,
    periods,
    shortNotice,
    daysAgo,
    openDay,
    setOpenDay,
    vacationOpen,
    setVacationOpen,
    bookings,
    upcoming,
    bookingsOn,
    planFor,
    freeOf,
    dayInfo,
    todayFree,
    todayNote,
    busyRange,
    setDay,
    saveDay,
    removePeriod,
    toggleNotice,
    saveRules,
    confirm,
  };
}
export type Kalendar = ReturnType<typeof useKalendar>;

/** The long form of today's note: „Днес не излизаш „Свободен днес“: …“ */
export function todayLine(k: Kalendar) {
  if (!k.todayNote) return "";
  return `Днес не излизаш „Свободен днес“: ${k.todayNote.text}${k.todayNote.reason === "short" ? " от работния ден" : ""}.`;
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------
/** A status mark without a number is a rivet: filled for agreed, an inset ring for waiting */
export function Rivet({ kind, className = "" }: { kind: BookingKind; className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-2.5 shrink-0 rounded-full ${kind === "proposed" ? "shadow-[inset_0_0_0_1.5px_var(--ink)]" : "bg-ink"} ${className}`}
    />
  );
}

export function PageTitle({ line }: { line?: string }) {
  return (
    <div>
      <h1 className="display text-5xl sm:text-6xl">Календар</h1>
      {line && <p className="mt-2 max-w-2xl text-lg text-ink-2">{line}</p>}
    </div>
  );
}

export const TITLE_LINE = "Клиентите виждат кога си свободен. Календарът е ориентировъчен: датата се потвърждава в чата.";

export function QuickActions({ k, layout }: { k: Kalendar; layout: "row" | "stack" | "chips" }) {
  const next = addDaysISO(k.weekStart, 7);
  const thisWeek = () => k.busyRange(k.today, addDaysISO(k.weekStart, 6), "Зает тази седмица", "Отбелязан си като зает до неделя.");
  const nextWeek = () =>
    k.busyRange(next, addDaysISO(next, 6), "Зает следващата седмица", "Следващата седмица е отбелязана като заета.");
  const vacation = () => k.setVacationOpen(true);

  if (layout === "chips") {
    return (
      <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" role="group" aria-label="Бързи действия">
        <button type="button" className="chip min-h-11 shrink-0 whitespace-nowrap" onClick={thisWeek}>
          <CalendarOff className="size-4" aria-hidden /> Зает тази седмица
        </button>
        <button type="button" className="chip min-h-11 shrink-0 whitespace-nowrap" onClick={nextWeek}>
          <CalendarOff className="size-4" aria-hidden /> Зает следващата седмица
        </button>
        <button type="button" className="chip min-h-11 shrink-0 whitespace-nowrap" onClick={vacation}>
          <Palmtree className="size-4" aria-hidden /> Отпуск…
        </button>
      </div>
    );
  }
  const btn = "btn btn-outline btn-lg justify-start whitespace-normal py-2 text-left leading-tight";
  return (
    <div className={`grid gap-2 ${layout === "row" ? "lg:grid-cols-3" : ""}`} role="group" aria-label="Бързи действия">
      <button type="button" className={btn} onClick={thisWeek}>
        <CalendarOff className="size-5 shrink-0" aria-hidden /> Зает съм тази седмица
      </button>
      <button type="button" className={btn} onClick={nextWeek}>
        <CalendarOff className="size-5 shrink-0" aria-hidden /> Зает съм следващата седмица
      </button>
      <button type="button" className={btn} onClick={vacation}>
        <Palmtree className="size-5 shrink-0" aria-hidden /> Отпуск или по-дълъг период
      </button>
    </div>
  );
}

export function SameDayToggle({ k }: { k: Kalendar }) {
  return (
    <label className="flex cursor-pointer items-center gap-4 rounded-[6px] bg-surface p-4 sm:p-5">
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold">Мога да дойда и в същия ден</span>
        <span className="mt-0.5 block text-sm text-ink-2">
          Без отметката не излизаш „Свободен днес“: клиентите, които търсят днес, те виждат свободен от утре.
        </span>
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={k.shortNotice}
          onChange={(e) => k.toggleNotice(e.target.checked)}
        />
        <span className="h-7 w-12 rounded-full bg-line-strong transition-colors peer-checked:bg-free peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink" />
        <span className="absolute left-1 top-1 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function BusyPeriods({ k }: { k: Kalendar }) {
  if (!k.periods.length) return null;
  const list = [...k.periods].sort((a, b) => a.from.localeCompare(b.from));
  return (
    <ul className="grid gap-1" aria-label="Заети периоди">
      {list.map((p) => (
        <li key={p.id} className="flex items-center gap-3 rounded-[6px] bg-surface py-1.5 pl-4 pr-2">
          <CalendarOff className="size-4 shrink-0 text-ink-2" aria-hidden />
          <span className="min-w-0 flex-1">
            <strong>{p.note}</strong>{" "}
            <span className="numerals text-lg text-ink-2">
              {formatDate(p.from)}
              {p.to !== p.from ? ` – ${formatDate(p.to)}` : ""}
            </span>
          </span>
          <button
            type="button"
            className="btn btn-ghost min-h-11"
            onClick={() => k.removePeriod(p.id)}
            aria-label={`Премахни ${p.note} ${formatDate(p.from)}`}
          >
            <Trash2 className="size-4" aria-hidden /> Премахни
          </button>
        </li>
      ))}
    </ul>
  );
}

/** A local copy of „Графикът ти актуален ли е?“, without a border */
export function ConfirmField({ k }: { k: Kalendar }) {
  const urgent = k.daysAgo >= 14;
  return (
    <div className={`flex flex-col gap-3 rounded-[10px] p-4 sm:flex-row sm:items-center sm:p-5 ${urgent ? "bg-rule-soft" : "bg-surface-2"}`}>
      <CalendarCheck className="size-7 shrink-0" strokeWidth={1.75} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-lg font-extrabold">{urgent ? "Потвърди графика си за следващата седмица" : "Графикът ти актуален ли е?"}</p>
        <p className="text-[0.95rem] text-ink-2">
          {k.daysAgo < 1
            ? "Потвърден днес."
            : `Последно потвърден преди ${Math.floor(k.daysAgo)} ${Math.floor(k.daysAgo) === 1 ? "ден" : "дни"}.`}{" "}
          {urgent ? "Докато не го потвърдиш, показваме те по-назад в търсенето." : "Потвърденият график те показва по-напред в търсенето."}
        </p>
      </div>
      <button type="button" className="btn btn-primary" onClick={k.confirm}>
        Всичко е вярно
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month grid. Cells are fields without borders.
// ---------------------------------------------------------------------------
export function MonthGrid({ k, marks }: { k: Kalendar; marks: boolean }) {
  const [page, setPage] = useState(0);
  const start = addDaysISO(k.weekStart, page * 35);
  const end = addDaysISO(start, 34);
  const cells = Array.from({ length: 35 }, (_, i) => addDaysISO(start, i));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" className="btn btn-ghost size-11 p-0" disabled={page === 0} onClick={() => setPage(0)} aria-label="Предишните 5 седмици">
          <ChevronLeft className="size-6" aria-hidden />
        </button>
        <h2 className="display text-center text-2xl sm:text-3xl" aria-live="polite">
          {formatDate(start)} – {formatDate(end)}
        </h2>
        <button type="button" className="btn btn-ghost size-11 p-0" disabled={page >= 1} onClick={() => setPage(1)} aria-label="Следващите 5 седмици">
          <ChevronRight className="size-6" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="pb-1 text-center text-xs font-bold uppercase text-ink-3">
            {w}
          </div>
        ))}
        {cells.map((iso, i) => {
          const info = k.dayInfo(iso);
          const date = parseISO(iso);
          const day = date.getUTCDate();
          const list = marks && !info.past ? k.bookingsOn(iso).slice(0, 3) : [];
          const tone = info.past
            ? "text-ink-3/50"
            : info.status === "free"
              ? "bg-free-soft hover:shadow-[var(--shadow-md)]"
              : info.status === "partial"
                ? "bg-surface hover:shadow-[var(--shadow-md)]"
                : "bg-surface-2 hover:shadow-[var(--shadow-md)]";
          const small = info.manual ? "ръчно" : day === 1 || (i === 0 && !info.isToday) ? MONTHS_SHORT[date.getUTCMonth()] : "";
          const word = info.status === "free" ? "свободен" : info.status === "partial" ? "частично свободен" : info.notToday ? "днес не излизаш свободен" : "зает";
          return (
            <button
              key={iso}
              type="button"
              disabled={info.past}
              onClick={() => k.setOpenDay(iso)}
              aria-label={`${formatDate(iso, true)}: ${info.past ? "минал" : word}${info.manual ? ", ръчно променен" : ""}`}
              className={`relative flex h-[4.5rem] min-w-0 flex-col justify-between rounded-[6px] p-1.5 text-left transition-shadow sm:h-[5.75rem] sm:p-2 ${tone}`}
            >
              <span className="flex items-start justify-between gap-1">
                <span className={`numerals text-lg leading-none sm:text-xl ${info.isToday ? "text-red" : ""}`}>{day}</span>
                {list.length > 0 && (
                  <span className="flex gap-1 pt-0.5">
                    {list.map((b) => (
                      <Rivet key={b.id} kind={b.kind} />
                    ))}
                  </span>
                )}
              </span>
              {!info.past && (
                <span className="block w-full min-w-0">
                  <span className="block h-3 truncate text-[0.62rem] font-semibold leading-3 text-ink-3">{small}</span>
                  {info.status === "busy" ? (
                    <span className="block whitespace-nowrap text-[0.65rem] font-bold leading-tight text-ink-3">{info.notToday ? "днес не" : "зает"}</span>
                  ) : (
                    <span className={`block h-1.5 w-full rounded-full ${info.status === "free" ? "bg-free" : "hatch"}`} />
                  )}
                  <span className="mt-0.5 hidden truncate text-[0.7rem] text-ink-2 sm:block">
                    {info.status === "busy" ? " " : shortHours(info.ranges)}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day sheet
// ---------------------------------------------------------------------------
export function DaySheet({ k }: { k: Kalendar }) {
  const date = k.openDay;
  const ref = useRef<HTMLDialogElement>(null);
  const plan = date ? k.planFor(date) : [];
  // Rows are reset from the day's plan whenever another day is opened
  const [forDate, setForDate] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  if (date !== forDate) {
    setForDate(date);
    setRows(toRows(plan));
  }
  const invalid = rows.some((r) => !rowOk(r));
  const changed = invalid || JSON.stringify(fromRows(rows)) !== JSON.stringify(plan);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (date && !d.open) d.showModal();
    if (!date && d.open) d.close();
  }, [date]);

  const info = date ? k.dayInfo(date) : null;
  const covering = date ? k.periods.filter((p) => p.from <= date && p.to >= date) : [];
  const list = date ? k.bookingsOn(date) : [];

  return (
    <dialog
      ref={ref}
      className="sheet"
      onClose={() => k.setOpenDay(null)}
      aria-labelledby="day-title"
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      {date && info && (
        <div className="safe-bottom p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="day-title" className="display text-4xl first-letter:uppercase">
                {formatDate(date, true)}
              </h2>
              <p className="mt-1 text-ink-2">
                {info.ranges.length === 0 ? "Сега: зает" : `Сега: свободен ${fullHours(info.ranges)}`}
                {info.manual && " (ръчно променен)"}
              </p>
            </div>
            <button type="button" className="btn btn-ghost size-11 p-0" onClick={() => ref.current?.close()} aria-label="Затвори">
              <X className="size-6" aria-hidden />
            </button>
          </div>

          {info.isToday && k.todayNote && <p className="mt-4 rounded-[10px] bg-rule-soft px-3 py-2.5 text-sm">{todayLine(k)}</p>}

          {covering.map((c) => (
            <div key={c.id} className="mt-4 flex flex-col gap-2 rounded-[10px] bg-rule-soft px-3 py-2.5 text-sm sm:flex-row sm:items-center sm:gap-3">
              <span className="flex-1">
                Денят е в период „{c.note}“ ({formatDate(c.from)} – {formatDate(c.to)}). Ако промениш часовете по-долу, те важат
                за този ден вместо периода.
              </span>
              <button type="button" className="btn btn-outline btn-sm min-h-11" onClick={() => k.removePeriod(c.id)}>
                Премахни периода
              </button>
            </div>
          ))}

          {list.length > 0 && (
            <div className="mt-5">
              <h3 className="display mb-2 text-[1.45rem]">Посещения този ден</h3>
              <ul className="grid gap-1">
                {list.map((b) => (
                  <li key={b.id} className="rounded-[6px] bg-paper px-4 py-3">
                    <p className="flex flex-wrap items-baseline gap-x-3">
                      <span className="numerals text-xl">{fullRange(b.start, b.end)}</span>
                      <span className="flex items-center gap-1.5 text-sm font-bold text-ink-2">
                        <Rivet kind={b.kind} /> {STATUS_WORD[b.kind]}
                      </span>
                    </p>
                    <p className="font-extrabold">{b.title}</p>
                    <p className="text-sm text-ink-2">{b.who}</p>
                    <Link href={b.href} className="link inline-flex min-h-11 items-center text-sm font-bold">
                      {b.kind === "job" ? "Виж в Поръчки" : "Отвори разговора"}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-lg bg-free text-white hover:bg-free/90" onClick={() => k.setDay(date, "free")}>
              Свободен цял ден
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => k.setDay(date, "busy")}>
              Зает цял ден
            </button>
          </div>
          <div className="mt-5 grid gap-3 rounded-[8px] bg-paper p-3">
            <p className="text-sm font-bold">Свободни часове този ден</p>
            <div className="flex flex-wrap gap-2">
              <SlotChips rows={rows} onChange={setRows} />
            </div>
            <RowList rows={rows} onChange={setRows} idPrefix="d" />
            <button type="button" className="btn btn-primary" disabled={invalid || !changed} onClick={() => k.saveDay(date, fromRows(rows))}>
              {invalid ? "Поправи часовете" : "Запази часовете за деня"}
            </button>
            <p className="text-xs text-ink-3">Уговорените в чата посещения се изваждат от свободните часове автоматично.</p>
          </div>
          {info.manual && (
            <button type="button" className="btn btn-ghost mt-4 w-full underline underline-offset-4" onClick={() => k.setDay(date, "reset")}>
              Върни деня по редовния график
            </button>
          )}
        </div>
      )}
    </dialog>
  );
}

export function VacationDialog({ k }: { k: Kalendar }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [from, setFrom] = useState(k.today);
  const [to, setTo] = useState(addDaysISO(k.today, 6));
  const [note, setNote] = useState("Отпуск");
  const invalid = to < from;
  const open = k.vacationOpen;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" aria-labelledby="vac-title" onClose={() => k.setVacationOpen(false)} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <form
        className="safe-bottom grid gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (invalid) return;
          k.busyRange(from, to, note.trim() || "Отпуск", "Периодът е отбелязан като зает.");
          ref.current?.close();
        }}
      >
        <div className="flex items-center justify-between">
          <h2 id="vac-title" className="display text-4xl">
            Зает период
          </h2>
          <button type="button" className="btn btn-ghost size-11 p-0" onClick={() => ref.current?.close()} aria-label="Затвори">
            <X className="size-6" aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="min-w-0">
            <label htmlFor="v-from" className="label">
              От
            </label>
            <DateField id="v-from" min={k.today} value={from} onChange={setFrom} required />
          </div>
          <div className="min-w-0">
            <label htmlFor="v-to" className="label">
              До (включително)
            </label>
            <DateField id="v-to" min={from} max={addDaysISO(from, 366)} value={to} onChange={setTo} invalid={invalid} required />
          </div>
        </div>
        {invalid && <p className="error-text">Крайната дата е преди началната.</p>}
        <div>
          <label htmlFor="v-note" className="label">
            Бележка <span className="font-normal text-ink-3">(виждате само вие)</span>
          </label>
          <input id="v-note" className="field" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary btn-lg" disabled={invalid}>
          Отбележи като зает
        </button>
      </form>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// „Редовен график“ („Лента“, variant-lenta.tsx)
// ---------------------------------------------------------------------------
/** A ready schedule as „the intervals of weekday wd (1 = Пн)“ */
export const presetDay = (p: SchedulePreset) => (wd: number) =>
  normalize(p.rules.filter((r) => r.weekday === wd).map((r): Interval => [toMin(r.start_time), toMin(r.end_time)]));
/** A ready schedule as seven lists of intervals, Пн…Нд */
export const presetWeek = (p: SchedulePreset): Interval[][] => Array.from({ length: 7 }, (_, i) => presetDay(p)(i + 1));

/**
 * The week in rows while it is being edited.
 * Календар (a saved schedule): only the open day sheet edits it; „Готово“ saves, a quick schedule saves the whole week at once.
 * First schedule (empty Календар, setup): nothing is saved until „Запази графика“.
 */
export function useWeekDraft(k: Kalendar, first: boolean) {
  const [week, setWeek] = useState<Row[][]>(() => k.rules.map(toRows));
  // A save or „Върни“ changes the saved rules: the rows follow them
  const [base, setBase] = useState(k.rules);
  if (base !== k.rules) {
    setBase(k.rules);
    setWeek(k.rules.map(toRows));
  }
  const lists = week.map(fromRows);
  const invalid = week.some((rows) => rows.some((r) => !rowOk(r)));
  return {
    week,
    lists,
    setDayRows: (i: number, rows: Row[]) => setWeek((w) => w.map((d, n) => (n === i ? rows : d))),
    /** the same hours on Пн–Пт */
    copyToWeekdays: (i: number) => setWeek((w) => w.map((d, n) => (n < 5 && n !== i ? toRows(fromRows(w[i])) : d))),
    /** back to an earlier state of the rows (a day sheet closed without „Готово“) */
    restore: (w: Row[][]) => setWeek(w),
    applyPreset: (p: SchedulePreset) =>
      first
        ? setWeek(presetWeek(p).map(toRows))
        : k.saveRules(presetWeek(p), { text: `Графикът е сменен на „${p.label}“.`, undo: k.rules }),
    clear: () => setWeek(emptyWeek().map(toRows)),
    /** „Готово“ in the day sheet; false keeps the sheet open */
    done: () => {
      if (invalid) {
        toast.error("Има интервал, в който краят е преди началото.");
        return false;
      }
      if (!first && JSON.stringify(lists) !== JSON.stringify(k.rules)) k.saveRules(lists);
      return true;
    },
    /** „Запази графика“ of the first schedule */
    save: () => {
      if (invalid) return void toast.error("Има интервал, в който краят е преди началото.");
      if (lists.every((l) => l.length === 0)) return void toast.error("Отбележи поне един работен ден.");
      k.saveRules(lists);
    },
  };
}

/** „Бързо: Пн–Пт 8–17 · Пн–Сб 8–18 · Вечери и уикенд“, and „Изчисти“ where nothing is saved yet */
export function PresetBar({ onPick, onClear }: { onPick: (p: SchedulePreset) => void; onClear?: () => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Готови графици">
      <span className="self-center text-sm font-bold">Бързо:</span>
      {SCHEDULE_PRESETS.map((p) => (
        <button key={p.id} type="button" className="chip min-h-11" onClick={() => onPick(p)}>
          {p.label}
        </button>
      ))}
      {onClear && (
        <button type="button" className="chip min-h-11" onClick={onClear}>
          Изчисти
        </button>
      )}
    </div>
  );
}

/** The box „Редовен график“ (The Yellow Band Rule) */
export function ScheduleSection({ children, help }: { children: ReactNode; help?: string }) {
  return (
    <section aria-labelledby="schedule-h" className="min-w-0 rounded-[10px] bg-surface">
      <div className="rounded-t-[10px] bg-rule px-5 py-2.5">
        <h2 id="schedule-h" className="display text-3xl">
          Редовен график
        </h2>
      </div>
      <div className="grid gap-4 p-4 sm:p-5">
        {help && <p className="text-ink-2">{help}</p>}
        {children}
      </div>
    </section>
  );
}

/** A new craftsman: the heading, the days of the variant, the same-day switch and the inline save button */
export function FirstScheduleFrame({ k, onSave, children }: { k: Kalendar; onSave: () => void; children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-5" aria-labelledby="first-h">
      <h2 id="first-h" className="display text-3xl sm:text-4xl">
        Още нямаш график. Кога обикновено работиш?
      </h2>
      {children}
      <SameDayToggle k={k} />
      <button type="button" className="btn btn-primary btn-lg justify-self-start" onClick={onSave}>
        Запази графика
      </button>
    </section>
  );
}
