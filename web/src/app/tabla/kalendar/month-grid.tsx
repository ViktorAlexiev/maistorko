"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Mark, STATUS_WORD, visitWhen, type DayInfo, type Kalendar } from "./calendar-parts";
import type { Visit } from "./calendar-editor";
import { addDaysISO, formatDate, MONTHS_SHORT, parseISO, WEEKDAYS_SHORT } from "@/lib/format";
import { toTime, type Interval } from "@/lib/intervals";

/**
 * „Метър“: each week is one segment of the yellow folding rule, the five segments folded on top of each other
 * with a brass rivet at alternate ends. A day is the rule cell of The One Graduation Rule: ticks, numeral,
 * the hours, then a green ink bar (free) or a hatched one (partial). A busy period is ink tape across its days.
 */
export function MonthGrid({ k, marks }: { k: Kalendar; marks: boolean }) {
  const p = usePages(k);
  const weeks = [0, 1, 2, 3, 4].map((w) => p.days.slice(w * 7, w * 7 + 7).map((iso, i) => cellOf(k, iso, w === 0 && i === 0, marks)));
  return (
    <section aria-labelledby="month-h" className="min-w-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <PageArrow dir="prev" disabled={p.page === 0} onClick={() => p.setPage(0)} />
        <RangeTitle id="month-h" start={p.start} end={p.end} className="text-center" />
        <PageArrow dir="next" disabled={p.page >= 1} onClick={() => p.setPage(1)} />
      </div>
      <div className="grid grid-cols-7 pb-1.5" aria-hidden>
        {WEEKDAYS_SHORT.map((w) => (
          <span key={w} className="text-center text-[0.68rem] font-bold uppercase leading-none text-ink-3">
            {w}
          </span>
        ))}
      </div>
      <div key={p.page} className="panel-in grid gap-1.5">
        {weeks.map((cells, w) => (
          <Segment key={cells[0].iso} k={k} cells={cells} hinge={w === 4 ? null : w % 2 === 0 ? "right" : "left"} />
        ))}
      </div>
      {marks && <MarksLegend className="mt-3" />}
    </section>
  );
}

/** The runs of one busy period inside a week: [first index, length, note] */
function tapes(cells: Cell[]) {
  const out: { from: number; len: number; note: string }[] = [];
  cells.forEach((c, i) => {
    if (c.kind !== "period") return;
    const last = out[out.length - 1];
    if (last && last.from + last.len === i && last.note === c.note) last.len++;
    else out.push({ from: i, len: 1, note: c.note });
  });
  return out;
}

function Segment({ k, cells, hinge }: { k: Kalendar; cells: Cell[]; hinge: "left" | "right" | null }) {
  return (
    <div className="relative grid grid-cols-7 rounded-[5px] bg-rule shadow-[inset_0_0_0_1px_rgb(22_20_15/0.35)]">
      {cells.map((c, i) => (
        <Day key={c.iso} k={k} c={c} first={i === 0} last={i === 6} />
      ))}
      {tapes(cells).map((t) => (
        <span
          key={t.from}
          aria-hidden
          className="pointer-events-none absolute bottom-[3px] flex h-6 items-center rounded-[3px] bg-ink px-2 sm:h-7"
          style={{ left: `calc(${t.from} / 7 * 100% + 3px)`, width: `calc(${t.len} / 7 * 100% - 6px)` }}
        >
          <span className="numerals truncate text-[0.82rem] uppercase tracking-[0.04em] text-rule sm:text-[0.95rem]">{t.note}</span>
        </span>
      ))}
      {hinge && (
        <span
          aria-hidden
          className={`absolute -bottom-2 z-10 size-2.5 rounded-full border border-ink/70 bg-brass ${hinge === "right" ? "right-4" : "left-4"}`}
        />
      )}
    </div>
  );
}

function Day({ k, c, first, last }: { k: Kalendar; c: Cell; first: boolean; last: boolean }) {
  const { info, kind } = c;
  const hidden = kind === "hidden";
  const quiet = kind === "rest" || kind === "busy" || kind === "period";
  const bar = kind === "free" || kind === "partial";
  const lines = bar ? info.ranges.slice(0, 2).map(range) : [];
  const more = bar ? info.ranges.length - 2 : 0;
  const word = kind === "rest" ? "почивка" : kind === "busy" ? "зает" : kind === "today-off" ? "днес не" : "";
  return (
    <button
      type="button"
      disabled={hidden}
      onClick={() => k.setOpenDay(c.iso)}
      aria-label={cellLabel(c)}
      className={`relative flex h-[4.75rem] min-w-0 flex-col items-center px-0.5 pt-3 transition-colors motion-reduce:transition-none focus-visible:z-10 focus-visible:outline-offset-[-2px] enabled:hover:bg-ink/[0.07] disabled:cursor-default sm:h-[5.75rem] sm:pt-3.5 ${
        first ? "rounded-l-[5px]" : ""
      } ${last ? "rounded-r-[5px]" : ""}`}
    >
      {/* graduations: a long tick at the left of each day (not at the rounded end), a half tick in its middle */}
      {!first && <span aria-hidden className="absolute left-0 top-0 h-[34%] w-px bg-ink" />}
      {info.isToday ? (
        <span aria-hidden className="absolute left-1/2 top-0 size-2.5 -translate-x-1/2 bg-red [clip-path:polygon(0_0,100%_0,50%_100%)]" />
      ) : (
        <span aria-hidden className="absolute left-1/2 top-0 h-[15%] w-px bg-ink/70" />
      )}

      <span
        className={`numerals relative leading-none text-[1.3rem] sm:text-[1.65rem] ${info.isToday ? "text-red" : hidden ? "opacity-30" : quiet ? "opacity-55" : ""}`}
      >
        {c.day}
        {c.month && <span className="ml-0.5 font-sans text-[0.6rem] font-extrabold uppercase sm:text-[0.68rem]">{c.month}</span>}
      </span>

      {c.visits.length > 0 && (
        <span aria-hidden className="absolute right-1 top-1 flex gap-0.5 sm:right-1.5 sm:top-1.5 sm:gap-1">
          {c.visits.slice(0, 2).map((v) => (
            <Mark key={v.id} kind={v.kind} className="size-2 sm:size-2.5" />
          ))}
        </span>
      )}

      {!hidden && (
        <span className="mb-[0.95rem] mt-auto flex min-w-0 max-w-full flex-col items-center gap-0.5 leading-none sm:mb-[1.15rem]">
          {lines.map((l) => (
            <span key={l} className="numerals truncate text-[0.8rem] leading-none sm:text-[0.98rem]">
              {l}
            </span>
          ))}
          {more > 0 && <span className="numerals text-[0.7rem] leading-none text-ink-2">+{more}</span>}
          {word && (
            <span className={`truncate text-[0.66rem] font-bold leading-none sm:text-xs ${kind === "today-off" ? "text-ink" : "text-ink/65"}`}>{word}</span>
          )}
          {info.manual && <span className="truncate text-[0.58rem] font-bold leading-none text-ink/60 sm:text-[0.65rem]">ръчно</span>}
        </span>
      )}

      {bar && (
        <span aria-hidden className={`absolute inset-x-[3px] bottom-[3px] h-2 rounded-[2px] sm:h-2.5 ${kind === "free" ? "bg-free" : "hatch"}`} />
      )}
      {k.openDay === c.iso && <span aria-hidden className="absolute inset-0 rounded-[3px] ring-[2.5px] ring-inset ring-red" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// What a day is, in the words the grid shows
// ---------------------------------------------------------------------------
/**
 * hidden: before today or beyond the 70 days; today-off: decision 6 („днес не“);
 * period: busy by a busy period (vacation); rest: no hours in the weekly schedule; busy: busy by hand or fully booked.
 */
type Kind = "hidden" | "today-off" | "free" | "partial" | "period" | "rest" | "busy";

type Cell = {
  iso: string;
  day: number;
  /** the short month beside the numeral on the 1st and on the first cell of the page */
  month: string | null;
  info: DayInfo;
  kind: Kind;
  /** the note of the covering busy period („Отпуск“) */
  note: string;
  visits: Visit[];
};

function cellOf(k: Kalendar, iso: string, first: boolean, marks: boolean): Cell {
  const info = k.dayInfo(iso);
  const date = parseISO(iso);
  const day = date.getUTCDate();
  const covering = k.periodsOn(iso);
  const kind: Kind =
    info.past || info.far
      ? "hidden"
      : info.notToday
        ? "today-off"
        : info.status !== "busy"
          ? info.status
          : !info.manual && covering.length
            ? "period"
            : !info.manual && k.planFor(iso).length === 0
              ? "rest"
              : "busy";
  return {
    iso,
    day,
    month: day === 1 || first ? MONTHS_SHORT[date.getUTCMonth()] : null,
    info,
    kind,
    note: kind === "period" ? covering[0].note : "",
    visits: marks && kind !== "hidden" ? k.visitsOn(iso) : [],
  };
}

// ---------------------------------------------------------------------------
// Hours
// ---------------------------------------------------------------------------
const sh = (m: number) => (m % 60 === 0 ? String(m / 60).padStart(2, "0") : toTime(m));
/** "08–18" */
const range = ([a, b]: Interval) => `${sh(a)}–${sh(b)}`;
const full = ([a, b]: Interval) => `${toTime(a)}–${b >= 1440 ? "24:00" : toTime(b)}`;

/** The day as the screen reader hears it */
function cellLabel(c: Cell) {
  const { info } = c;
  const hours = info.ranges.map(full).join(", ");
  const what = info.past
    ? "минал"
    : info.far
      ? "извън периода"
      : {
          "today-off": "днес не излизаш свободен",
          free: `свободен ${hours}`,
          partial: `частично свободен ${hours}`,
          period: `зает, ${c.note}`,
          rest: "почивен ден",
          busy: "зает",
          hidden: "",
        }[c.kind];
  const extra = [info.manual ? "ръчно променен" : "", ...c.visits.map((v) => `${STATUS_WORD[v.kind]} ${visitWhen(v)}`)].filter(Boolean);
  return `${formatDate(c.iso, true)}: ${what}${extra.length ? `, ${extra.join(", ")}` : ""}`;
}

function MarksLegend({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2 ${className}`} aria-label="Знаци в дните">
      {(["confirmed", "proposed", "job"] as const).map((kind) => (
        <li key={kind} className="flex items-center gap-1.5">
          <Mark kind={kind} /> {STATUS_WORD[kind]}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Pages: five weeks from the Monday of this week, then the next five
// ---------------------------------------------------------------------------
function usePages(k: Kalendar) {
  const [page, setPage] = useState(0);
  const start = addDaysISO(k.weekStart, page * 35);
  const end = addDaysISO(start, 34);
  const days = Array.from({ length: 35 }, (_, i) => addDaysISO(start, i));
  return { page, setPage, start, end, days };
}

function PageArrow({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      className="btn btn-ghost size-11 shrink-0 p-0"
      disabled={disabled}
      onClick={onClick}
      aria-label={dir === "prev" ? "Предишните 5 седмици" : "Следващите 5 седмици"}
    >
      <Icon className="size-6" aria-hidden />
    </button>
  );
}

/** „16 ноември до 20 декември“, without a dash */
function RangeTitle({ id, start, end, className = "" }: { id: string; start: string; end: string; className?: string }) {
  return (
    <h2 id={id} className={`display text-2xl sm:text-3xl ${className}`} aria-live="polite">
      {formatDate(start)} <span className="font-sans text-base font-semibold text-ink-3 sm:text-lg">до</span> {formatDate(end)}
    </h2>
  );
}
