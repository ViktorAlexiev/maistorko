"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { RuleLegend, RuleStrip } from "@/components/rule-strip";
import { addDaysISO, formatDate, isoWeekday, MONTHS_SHORT, parseISO, WEEKDAYS_SHORT } from "@/lib/format";
import {
  BusyPeriods,
  ConfirmField,
  FirstSchedule,
  fullRange,
  MonthGrid,
  PageTitle,
  QuickActions,
  Rivet,
  SameDayToggle,
  ScheduleEditor,
  STATUS_WORD,
  TITLE_LINE,
  weekSummary,
  type Kalendar,
} from "./shared";

const CODE = { free: "F", partial: "P", busy: "B" } as const;

/** „Метър“: the 14-day folding rule leads, bookings in their own box, the week view is kept. */
export function VariantMetar({ k, schedule }: { k: Kalendar; /** another „Редовен график“ section (the planning page of that section); the default is the closed box */ schedule?: (k: Kalendar) => ReactNode }) {
  const [view, setView] = useState<"month" | "week">("month");
  if (!k.hasSchedule) {
    return (
      <div className="grid min-w-0 gap-8">
        <PageTitle />
        {schedule ? schedule(k) : <FirstSchedule k={k} />}
      </div>
    );
  }
  const strip = Array.from({ length: 14 }, (_, i) => CODE[k.dayInfo(addDaysISO(k.today, i)).status]).join("");

  return (
    <div className="grid min-w-0 gap-10">
      <PageTitle line={TITLE_LINE} />

      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="grid min-w-0 gap-5">
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

          {k.todayNote && (
            <p className="rounded-[10px] bg-rule-soft px-4 py-3 text-[0.95rem]">
              Днес вече не излизаш свободен ({k.todayNote.text}). За клиентите си свободен от утре.
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

          <div className="min-w-0">{view === "month" ? <MonthGrid k={k} marks={false} /> : <WeekView k={k} />}</div>
        </div>

        <aside className="grid min-w-0 gap-4" aria-label="Уговорено и бързи действия">
          <BookingsBox k={k} />
          <QuickActions k={k} layout="stack" />
          <SameDayToggle k={k} />
        </aside>
      </div>

      <BusyPeriods k={k} />
      <ConfirmField k={k} />
      {schedule ? schedule(k) : <ScheduleBox k={k} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week: vertical time bars 06 to 22, alternate soft bands instead of hour lines
// ---------------------------------------------------------------------------
const H0 = 6 * 60;
const H1 = 22 * 60;
const pct = (m: number) => ((Math.min(Math.max(m, H0), H1) - H0) / (H1 - H0)) * 100;
const BANDS = [8, 12, 16, 20];

function WeekView({ k }: { k: Kalendar }) {
  const [week, setWeek] = useState(0);
  const start = addDaysISO(k.weekStart, week * 7);
  const dates = Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" className="btn btn-ghost size-11 p-0" disabled={week === 0} onClick={() => setWeek((w) => w - 1)} aria-label="Предишна седмица">
          <ChevronLeft className="size-6" aria-hidden />
        </button>
        <h2 className="display text-center text-2xl sm:text-3xl" aria-live="polite">
          {formatDate(dates[0])} – {formatDate(dates[6])}
        </h2>
        <button type="button" className="btn btn-ghost size-11 p-0" disabled={week >= 9} onClick={() => setWeek((w) => w + 1)} aria-label="Следваща седмица">
          <ChevronRight className="size-6" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-[1.75rem_repeat(7,minmax(0,1fr))] gap-1 sm:grid-cols-[2.25rem_repeat(7,minmax(0,1fr))] sm:gap-2">
        <div />
        {dates.map((d) => (
          <div key={d} className="text-center">
            <div className="text-xs font-bold uppercase text-ink-3">{WEEKDAYS_SHORT[isoWeekday(d) - 1]}</div>
            <div className={`numerals text-xl ${d === k.today ? "text-red" : ""}`}>{parseISO(d).getUTCDate()}</div>
          </div>
        ))}
        <div className="relative h-80">
          {[6, 8, 10, 12, 14, 16, 18, 20, 22].map((h) => (
            <span key={h} className="numerals absolute right-0.5 -translate-y-1/2 text-xs text-ink-3" style={{ top: `${pct(h * 60)}%` }}>
              {String(h).padStart(2, "0")}
            </span>
          ))}
        </div>
        {dates.map((d) => {
          const info = k.dayInfo(d);
          const booked = k.bookingsOn(d);
          return (
            <button
              key={d}
              type="button"
              disabled={info.past}
              onClick={() => k.setOpenDay(d)}
              aria-label={`${formatDate(d, true)}: ${info.ranges.length ? info.ranges.map(([a, b]) => fullRange(a, b)).join(", ") : "зает"}`}
              className="relative h-80 min-w-0 overflow-hidden rounded-[6px] bg-surface-2 transition-shadow hover:shadow-[var(--shadow-md)] disabled:opacity-40"
            >
              {BANDS.map((h) => (
                <span key={h} aria-hidden className="absolute inset-x-0 bg-surface/70" style={{ top: `${pct(h * 60)}%`, height: `${pct((h + 2) * 60) - pct(h * 60)}%` }} />
              ))}
              {info.ranges.map(([a, b]) => (
                <span
                  key={a}
                  className={`absolute inset-x-1 rounded-[4px] ${info.notToday ? "bg-free/40" : "bg-free"}`}
                  style={{ top: `${pct(a)}%`, height: `${Math.max(pct(b) - pct(a), 2)}%` }}
                />
              ))}
              {!info.past &&
                booked.map((b) => (
                  <span
                    key={b.id}
                    className={`absolute inset-x-0.5 z-10 overflow-hidden rounded-[4px] p-0.5 text-left text-[0.65rem] font-bold leading-tight ${
                      b.kind === "proposed" ? "text-ink shadow-[inset_0_0_0_1.5px_var(--ink)]" : "bg-ink text-white"
                    }`}
                    style={{
                      top: `${pct(b.start)}%`,
                      height: `${Math.max(pct(b.end) - pct(b.start), 4)}%`,
                      ...(b.kind === "proposed"
                        ? { backgroundImage: "repeating-linear-gradient(-45deg, rgb(22 20 15 / 0.3) 0 1.5px, transparent 1.5px 5px)" }
                        : {}),
                    }}
                  >
                    <span className={`hidden sm:block ${b.kind === "proposed" ? "rounded-[2px] bg-surface/85 px-0.5" : ""}`}>{b.title}</span>
                  </span>
                ))}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-ink-3">
        Зелено: свободни часове. Тъмно: уговорено посещение. Щриховано: чака отговор. Докоснете ден, за да го промените.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The box „Уговорени посещения“ (The Yellow Band Rule)
// ---------------------------------------------------------------------------
function BookingsBox({ k }: { k: Kalendar }) {
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
          {k.upcoming.map((b) => {
            const date = parseISO(b.date);
            return (
              <li key={b.id}>
                <Link
                  href={b.href}
                  className="grid min-h-11 grid-cols-[3rem_minmax(0,1fr)] gap-3 rounded-[6px] bg-paper p-3 transition-shadow hover:shadow-[var(--shadow-md)]"
                >
                  <span className="text-center">
                    <span className={`numerals block text-3xl leading-none ${b.date === k.today ? "text-red" : ""}`}>{date.getUTCDate()}</span>
                    <span className="block text-xs font-bold uppercase text-ink-3">{MONTHS_SHORT[date.getUTCMonth()]}</span>
                  </span>
                  <span className="min-w-0">
                    <span className="numerals block text-lg leading-tight">{fullRange(b.start, b.end)}</span>
                    <span className="block font-extrabold leading-snug">{b.title}</span>
                    <span className="block text-sm text-ink-2">{b.who}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-sm font-bold text-ink-2">
                      <Rivet kind={b.kind} /> {STATUS_WORD[b.kind]}
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
// „Редовен график“ as a closed box that opens
// ---------------------------------------------------------------------------
function ScheduleBox({ k }: { k: Kalendar }) {
  const [open, setOpen] = useState(false);
  return (
    <section aria-labelledby="schedule-h" className="min-w-0 rounded-[10px] bg-surface">
      <div className="flex items-center justify-between gap-3 rounded-t-[10px] bg-rule px-5 py-2.5">
        <h2 id="schedule-h" className="display text-3xl">
          Редовен график
        </h2>
        {open && (
          <button type="button" className="btn btn-ghost size-11 p-0" onClick={() => setOpen(false)} aria-label="Затвори редовния график">
            <X className="size-6" aria-hidden />
          </button>
        )}
      </div>
      <div className="p-4 sm:p-5">
        {!open && (
          <div className="grid gap-4">
            <ul className="grid gap-1">
              {weekSummary(k.rules).map((line) => (
                <li key={line} className="numerals rounded-[6px] bg-paper px-4 py-2.5 text-lg">
                  {line}
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-outline btn-lg justify-self-start" onClick={() => setOpen(true)}>
              Промени редовния график
            </button>
          </div>
        )}
        <div className={open ? "" : "hidden"}>
          <ScheduleEditor k={k} tone="paper" />
        </div>
      </div>
    </section>
  );
}
