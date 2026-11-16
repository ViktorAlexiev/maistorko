"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import type { CSSProperties } from "react";
import { CalendarCheck, CalendarOff, Palmtree, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { confirmCalendar } from "@/app/actions/dashboard";
import { DateField } from "@/components/date-time-fields";
import { RuleLegend, RuleStrip } from "@/components/rule-strip";
import {
  addDaysISO,
  formatDate,
  MONTHS_SHORT,
  parseISO,
} from "@/lib/format";
import { endMin, fromRows, rowOk, toMin, toRows, toTime, type Interval, type Row } from "@/lib/intervals";
import { RowList, SlotChips } from "./interval-editor";
import type { Visit } from "./calendar-editor";

// ---------------------------------------------------------------------------
// Types and small helpers
// ---------------------------------------------------------------------------
export type Status = "free" | "partial" | "busy";
export type Period = { id: string; from: string; to: string; note: string };

export type DayInfo = {
  iso: string;
  /** a day before today: not shown and not editable */
  past: boolean;
  /** the database sent nothing for this day (beyond the 70 days) */
  far: boolean;
  isToday: boolean;
  /** free intervals by the database: after the schedule, changes, periods, bookings, jobs and today's rule */
  ranges: Interval[];
  status: Status;
  /** the day was changed by hand */
  manual: boolean;
  /** today, with a working day, but not shown as „Свободен днес“ */
  notToday: boolean;
};

/** The state of the page and what it can do; built in `calendar-editor.tsx` */
export type Kalendar = {
  userId: string;
  today: string;
  nowMin: number;
  weekStart: string;
  busy: boolean;
  shortNotice: boolean;
  daysAgo: number;
  openDay: string | null;
  setOpenDay: (iso: string | null) => void;
  vacationOpen: boolean;
  setVacationOpen: (open: boolean) => void;
  /** the list „Заети периоди“ */
  periods: Period[];
  /** the multi-day periods that cover the day */
  periodsOn: (iso: string) => Period[];
  upcoming: Visit[];
  visitsOn: (iso: string) => Visit[];
  /** what the day offers before bookings (the weekly schedule and changes) */
  planFor: (iso: string) => Interval[];
  dayInfo: (iso: string) => DayInfo;
  todayNote: { reason: "short" | "off"; text: string } | null;
  busyRange: (from: string, to: string, note: string, label: string) => void;
  setDay: (date: string, mode: "free" | "busy" | "reset") => void;
  saveDay: (date: string, list: Interval[]) => void;
  removePeriod: (id: string) => void;
  onConfirmed: () => void;
};

export const STATUS_WORD: Record<Visit["kind"], string> = {
  confirmed: "потвърдено",
  proposed: "чака отговор",
  job: "поръчка",
};

/** "08:00–18:00" */
const fullRange = (a: number, b: number) => `${toTime(a)}–${b >= 1440 ? "24:00" : toTime(b)}`;
const fullHours = (list: Interval[]) => list.map(([a, b]) => fullRange(a, b)).join(", ");

/** The minutes a visit takes in its day; a visit without hours takes the whole day */
export const visitSpan = (v: Visit): [number, number] => [v.start ? toMin(v.start) : 0, v.end ? endMin(v.end) : 1440];
/** "10:00–12:00", or „цял ден“ without hours */
export const visitWhen = (v: Visit) => {
  if (!v.start || !v.end) return v.endDate ? `цели дни до ${formatDate(v.endDate)}` : "цял ден";
  const [a, b] = visitSpan(v);
  return fullRange(a, b);
};

export const REASON_SHORT = "остава по-малко от 2 часа";
export const REASON_OFF = "без отметката „Мога да дойда и в същия ден“";

/** The long form of today's note in the day sheet: „Днес не излизаш „Свободен днес“: …“ */
function todayLine(k: Kalendar) {
  if (!k.todayNote) return "";
  return `Днес не излизаш „Свободен днес“: ${k.todayNote.text}${k.todayNote.reason === "short" ? " от работния ден" : ""}.`;
}

/** A status mark without a number: a confirmed visit is a filled rivet, one waiting for an answer an open ring, an order a square */
export function Mark({ kind, className = "size-2.5", style }: { kind: Visit["kind"]; className?: string; style?: CSSProperties }) {
  const shape =
    kind === "job" ? "rounded-[2px] bg-ink" : kind === "proposed" ? "rounded-full bg-surface shadow-[inset_0_0_0_1.5px_var(--ink)]" : "rounded-full bg-ink";
  return <span aria-hidden style={style} className={`inline-block shrink-0 ${shape} ${className}`} />;
}

const CODE = { free: "F", partial: "P", busy: "B" } as const;

// ---------------------------------------------------------------------------
// The meter: the next 14 days as the folding rule, with its legend
// ---------------------------------------------------------------------------
export function Meter({ k }: { k: Kalendar }) {
  const strip = Array.from({ length: 14 }, (_, i) => CODE[k.dayInfo(addDaysISO(k.today, i)).status]).join("");
  return (
    <div className="min-w-0">
      <RuleLegend className="mb-3" />
      <div className="overflow-x-auto">
        <RuleStrip
          strip={strip}
          start={k.today}
          size="lg"
          onPick={(iso) => k.setOpenDay(iso)}
          selected={k.openDay}
          label="Следващите 14 дни: докоснете ден, за да го промените"
          className="min-w-[32rem]"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The box „Уговорени посещения“ (The Yellow Band Rule)
// ---------------------------------------------------------------------------
export function BookingsBox({ k }: { k: Kalendar }) {
  return (
    <section aria-labelledby="bookings-h" className="rounded-[10px] bg-surface">
      <div className="rounded-t-[10px] bg-rule px-5 py-2.5">
        <h2 id="bookings-h" className="display text-3xl">
          Уговорени посещения
        </h2>
      </div>
      {k.upcoming.length === 0 ? (
        <p className="p-5 text-ink-2">Няма уговорени посещения.</p>
      ) : (
        <ul className="grid gap-1 p-3">
          {k.upcoming.map((v) => {
            const date = parseISO(v.date);
            return (
              <li key={v.id}>
                <Link
                  href={v.href}
                  className="grid min-h-11 grid-cols-[3rem_minmax(0,1fr)] gap-3 rounded-[6px] bg-paper p-3 transition-shadow motion-reduce:transition-none hover:shadow-[var(--shadow-md)]"
                >
                  <span className="text-center">
                    <span className={`numerals block text-3xl leading-none ${v.date === k.today ? "text-red" : ""}`}>{date.getUTCDate()}</span>
                    <span className="block text-xs font-bold uppercase text-ink-3">{MONTHS_SHORT[date.getUTCMonth()]}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="numerals block text-lg leading-tight">{visitWhen(v)}</span>
                    <span className="block font-extrabold leading-snug">{v.title}</span>
                    <span className="block text-sm text-ink-2">{v.who}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-sm font-bold text-ink-2">
                      <Mark kind={v.kind} /> {STATUS_WORD[v.kind]}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Quick actions
// ---------------------------------------------------------------------------
export function QuickActions({ k }: { k: Kalendar }) {
  const next = addDaysISO(k.weekStart, 7);
  const btn = "btn btn-outline btn-lg justify-start whitespace-normal py-2 text-left leading-tight";
  return (
    <div className="grid gap-2" role="group" aria-label="Бързи действия">
      <button
        type="button"
        className={btn}
        disabled={k.busy}
        onClick={() => k.busyRange(k.today, addDaysISO(k.weekStart, 6), "Зает тази седмица", "Отбелязан си като зает до неделя.")}
      >
        <CalendarOff className="size-5 shrink-0" aria-hidden /> Зает съм тази седмица
      </button>
      <button
        type="button"
        className={btn}
        disabled={k.busy}
        onClick={() => k.busyRange(next, addDaysISO(next, 6), "Зает следващата седмица", "Следващата седмица е отбелязана като заета.")}
      >
        <CalendarOff className="size-5 shrink-0" aria-hidden /> Зает съм следващата седмица
      </button>
      <button type="button" className={btn} disabled={k.busy} onClick={() => k.setVacationOpen(true)}>
        <Palmtree className="size-5 shrink-0" aria-hidden /> Отпуск или по-дълъг период
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Busy periods
// ---------------------------------------------------------------------------
export function BusyPeriods({ k }: { k: Kalendar }) {
  if (!k.periods.length) return null;
  return (
    <ul className="grid gap-1" aria-label="Заети периоди">
      {k.periods.map((p) => (
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
            disabled={k.busy}
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

// ---------------------------------------------------------------------------
// „Графикът ти актуален ли е?“, without a border (the banner of /tabla keeps its own)
// ---------------------------------------------------------------------------
export function ConfirmField({ k }: { k: Kalendar }) {
  const [pending, start] = useTransition();
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
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await confirmCalendar(k.userId);
            if (res.ok) {
              k.onConfirmed();
              toast.success(res.message);
            } else toast.error(res.message);
          })
        }
      >
        {pending ? "Потвърждаваме…" : "Всичко е вярно"}
      </button>
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
  const covering = date ? k.periodsOn(date) : [];
  const list = date ? k.visitsOn(date) : [];

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
              <button type="button" className="btn btn-outline btn-sm min-h-11" disabled={k.busy} onClick={() => k.removePeriod(c.id)}>
                Премахни периода
              </button>
            </div>
          ))}

          {list.length > 0 && (
            <div className="mt-5">
              <h3 className="display mb-2 text-[1.45rem]">Посещения този ден</h3>
              <ul className="grid gap-1">
                {list.map((v) => (
                  <li key={v.id} className="rounded-[6px] bg-paper px-4 py-3">
                    <p className="flex flex-wrap items-baseline gap-x-3">
                      <span className="numerals text-xl">{visitWhen(v)}</span>
                      <span className="flex items-center gap-1.5 text-sm font-bold text-ink-2">
                        <Mark kind={v.kind} /> {STATUS_WORD[v.kind]}
                      </span>
                    </p>
                    <p className="font-extrabold">{v.title}</p>
                    <p className="text-sm text-ink-2">{v.who}</p>
                    <Link href={v.href} className="link inline-flex min-h-11 items-center text-sm font-bold">
                      {v.kind === "job" ? "Виж в Поръчки" : "Отвори разговора"}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-lg bg-free text-white hover:bg-free/90" disabled={k.busy} onClick={() => k.setDay(date, "free")}>
              Свободен цял ден
            </button>
            <button type="button" className="btn btn-primary btn-lg" disabled={k.busy} onClick={() => k.setDay(date, "busy")}>
              Зает цял ден
            </button>
          </div>
          <div className="mt-5 grid gap-3 rounded-[8px] bg-paper p-3">
            <p className="text-sm font-bold">Свободни часове този ден</p>
            <div className="flex flex-wrap gap-2">
              <SlotChips rows={rows} onChange={setRows} />
            </div>
            <RowList rows={rows} onChange={setRows} idPrefix="d" />
            <button
              type="button"
              className="btn btn-primary"
              disabled={k.busy || invalid || !changed}
              onClick={() => k.saveDay(date, fromRows(rows))}
            >
              {invalid ? "Поправи часовете" : "Запази часовете за деня"}
            </button>
            <p className="text-xs text-ink-3">Уговорените в чата посещения се изваждат от свободните часове автоматично.</p>
          </div>
          {info.manual && (
            <button type="button" className="btn btn-ghost mt-4 w-full underline underline-offset-4" disabled={k.busy} onClick={() => k.setDay(date, "reset")}>
              Върни деня по редовния график
            </button>
          )}
        </div>
      )}
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Vacation or a longer busy period
// ---------------------------------------------------------------------------
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
