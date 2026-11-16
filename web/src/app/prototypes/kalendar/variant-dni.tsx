"use client";

import { useState } from "react";
import { addDaysISO, formatDate, isoWeekday, MONTHS, parseISO, WEEKDAYS_SHORT } from "@/lib/format";
import {
  BusyPeriods,
  ConfirmField,
  FirstSchedule,
  fullHours,
  fullRange,
  PageTitle,
  QuickActions,
  SameDayToggle,
  ScheduleEditor,
  type BookingKind,
  type Kalendar,
} from "./shared";

const MAX_WEEKS = 10;
const H0 = 6 * 60;
const H1 = 22 * 60;
const pct = (m: number) => ((Math.min(Math.max(m, H0), H1) - H0) / (H1 - H0)) * 100;

/** „Дни“: an agenda of days, bookings written inline, phone first. */
export function VariantDni({ k }: { k: Kalendar }) {
  const [weeks, setWeeks] = useState(2);
  if (!k.hasSchedule) {
    return (
      <div className="grid min-w-0 gap-8">
        <PageTitle />
        <FirstSchedule k={k} />
      </div>
    );
  }
  const more = Math.min(3, MAX_WEEKS - weeks);

  return (
    <div className="grid min-w-0 gap-10">
      <PageTitle />
      <QuickActions k={k} layout="chips" />

      <div className="grid min-w-0 gap-7">
        {Array.from({ length: weeks }, (_, w) => {
          const start = addDaysISO(k.weekStart, w * 7);
          return (
            <section key={start} aria-labelledby={`w-${w}`} className="min-w-0">
              <h2 id={`w-${w}`} className="display mb-2 text-[1.7rem]">
                {w === 0 ? "Тази седмица" : w === 1 ? "Следващата седмица" : weekLabel(start)}
              </h2>
              <ul className="grid gap-1">
                {Array.from({ length: 7 }, (_, i) => (
                  <li key={i}>
                    <DayStrip k={k} iso={addDaysISO(start, i)} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {more > 0 && (
          <button type="button" className="btn btn-outline btn-lg w-full sm:w-auto sm:justify-self-start" onClick={() => setWeeks((n) => n + more)}>
            Покажи още {more} {more === 1 ? "седмица" : "седмици"}
          </button>
        )}
      </div>

      <section aria-label="Настройки" className="grid gap-4">
        <SameDayToggle k={k} />
        <BusyPeriods k={k} />
      </section>
      <ConfirmField k={k} />

      <section aria-labelledby="schedule-h" className="min-w-0">
        <h2 id="schedule-h" className="display mb-4 text-4xl">
          Редовен график
        </h2>
        <ScheduleEditor k={k} />
      </section>
    </div>
  );
}

function weekLabel(start: string) {
  const end = addDaysISO(start, 6);
  const a = parseISO(start);
  const b = parseISO(end);
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()} – ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`
    : `${formatDate(start)} – ${formatDate(end)}`;
}

function Tag({ kind }: { kind: BookingKind }) {
  const base = "rounded-[4px] px-1.5 py-0.5 text-xs font-bold leading-tight";
  if (kind === "proposed") return <span className={`${base} text-ink shadow-[inset_0_0_0_1px_var(--ink)]`}>чака отговор</span>;
  return <span className={`${base} bg-ink text-rule`}>{kind === "confirmed" ? "потвърдено" : "поръчка"}</span>;
}

function DayStrip({ k, iso }: { k: Kalendar; iso: string }) {
  const info = k.dayInfo(iso);
  const list = k.bookingsOn(iso);
  const wd = isoWeekday(iso);
  const ground = info.notToday ? "bg-rule-soft" : info.status === "busy" ? "bg-surface-2" : "bg-surface";
  const hours = info.ranges.length ? fullHours(info.ranges) : info.off ? "почивен" : "зает";

  return (
    <button
      type="button"
      disabled={info.past}
      onClick={() => k.setOpenDay(iso)}
      aria-label={`${formatDate(iso, true)}: ${hours}`}
      className={`grid min-h-[4.5rem] w-full min-w-0 grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-3 rounded-[6px] p-3 text-left transition-shadow hover:shadow-[var(--shadow-md)] disabled:opacity-45 disabled:hover:shadow-none ${ground}`}
    >
      <span className="block text-center">
        <span className={`numerals block text-4xl leading-none ${info.isToday ? "text-red" : ""}`}>{parseISO(iso).getUTCDate()}</span>
        <span className="mt-0.5 block text-xs font-bold uppercase text-ink-3">{WEEKDAYS_SHORT[wd - 1]}</span>
      </span>
      <span className="block min-w-0">
        <span className="numerals block text-xl leading-tight">{hours}</span>
        {!info.past && (
          <span aria-hidden className={`relative mt-1.5 block h-2 w-full overflow-hidden rounded-[2px] ${info.status === "busy" ? "bg-paper" : "bg-surface-2"}`}>
            {info.ranges.map(([a, b]) => (
              <span
                key={a}
                className={`absolute inset-y-0 rounded-[2px] ${info.notToday ? "bg-free/40" : "bg-free"}`}
                style={{ left: `${pct(a)}%`, width: `${Math.max(pct(b) - pct(a), 1.5)}%` }}
              />
            ))}
          </span>
        )}
        {info.notToday && (
          <span className="mt-2 block text-sm font-semibold">Днес вече не излизаш свободен: {k.todayNote?.text}.</span>
        )}
        {!info.past &&
          list.map((b) => (
            <span key={b.id} className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="numerals text-base">{fullRange(b.start, b.end)}</span>
              <span className="min-w-0">
                {b.title} · {b.who}
              </span>
              <Tag kind={b.kind} />
            </span>
          ))}
      </span>
    </button>
  );
}
