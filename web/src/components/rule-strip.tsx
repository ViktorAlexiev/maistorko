"use client";

import { useState } from "react";
import {
  addDaysISO,
  isoWeekday,
  MONTHS_SHORT,
  parseISO,
  todayISO,
  WEEKDAYS,
  WEEKDAYS_LETTER,
} from "@/lib/format";

export type DayStatus = "F" | "P" | "B";

const STATUS_LABEL: Record<DayStatus, string> = {
  F: "свободен",
  P: "частично свободен",
  B: "зает",
};

type Props = {
  /** One char per day: F (free), P (partial), B (busy) */
  strip: string;
  start?: string;
  size?: "sm" | "md" | "lg";
  /** Unfold segment by segment on first paint (pure CSS; content is never hidden without it) */
  unfold?: boolean;
  selected?: string | null;
  onPick?: (iso: string, status: DayStatus) => void;
  label?: string;
  className?: string;
};

/**
 * The folding rule: the next N days as graduated segments, hinged every 7 days.
 * Free days are inked solid, partial days hatched, busy days left bare.
 */
export function RuleStrip({
  strip,
  start,
  size = "sm",
  unfold = false,
  selected,
  onPick,
  label = "Свободни дни",
  className = "",
}: Props) {
  const [from] = useState(() => start ?? todayISO());
  const today = todayISO();

  const days = strip.split("").map((s, i) => ({ iso: addDaysISO(from, i), status: s as DayStatus }));
  const segments: (typeof days)[] = [];
  for (let i = 0; i < days.length; i += 7) segments.push(days.slice(i, i + 7));

  const h = size === "lg" ? "h-[4.75rem]" : size === "md" ? "h-14" : "h-11";
  const num = size === "lg" ? "text-[1.6rem]" : size === "md" ? "text-xl" : "text-[1.05rem]";
  const ink = size === "lg" ? "h-2.5" : size === "md" ? "h-2" : "h-1.5";
  const interactive = Boolean(onPick);

  return (
    <div
      role={interactive ? "group" : "img"}
      aria-label={
        interactive
          ? label
          : `${label}: ${days
              .filter((d) => d.status !== "B")
              .map((d) => `${parseISO(d.iso).getUTCDate()} ${MONTHS_SHORT[parseISO(d.iso).getUTCMonth()]}`)
              .join(", ") || "няма свободни дни в следващите 2 седмици"}`
      }
      className={`fold-stage flex ${className}`}
      data-unfold={unfold ? "true" : "false"}
    >
      {segments.map((seg, si) => (
        <div
          key={si}
          className={`fold-segment relative flex flex-1 bg-rule ${h} ${
            si === 0 ? "rounded-l-[5px]" : ""
          } ${si === segments.length - 1 ? "rounded-r-[5px]" : ""} shadow-[inset_0_0_0_1px_rgb(22_20_15/0.35)]`}
          style={{ ["--i" as string]: si }}
        >
          {si > 0 && (
            <span
              aria-hidden
              className="absolute -left-[5px] top-1/2 z-10 size-2.5 -translate-y-1/2 rounded-full border border-ink/70 bg-brass"
            />
          )}
          {seg.map((d, di) => {
            const date = parseISO(d.iso);
            const isToday = d.iso === today;
            const isSelected = selected === d.iso;
            const weekday = isoWeekday(d.iso);
            const weekend = weekday >= 6;
            const cellLabel = `${WEEKDAYS[weekday - 1]}, ${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}: ${STATUS_LABEL[d.status]}`;
            const inner = (
              <>
                {/* graduations */}
                <span aria-hidden className="absolute left-0 top-0 h-[38%] w-px bg-ink" />
                <span aria-hidden className="absolute left-1/2 top-0 h-[18%] w-px bg-ink/70" />
                <span
                  aria-hidden
                  className={`numerals relative mt-[22%] leading-none ${num} ${isToday ? "text-red" : "text-ink"}`}
                >
                  {date.getUTCDate()}
                </span>
                {size !== "sm" && (
                  <span
                    aria-hidden
                    className={`relative text-[0.68rem] font-bold uppercase leading-none ${weekend ? "text-ink/60" : "text-ink/80"}`}
                  >
                    {WEEKDAYS_LETTER[weekday - 1]}
                  </span>
                )}
                <span
                  aria-hidden
                  className={`absolute inset-x-[3px] bottom-[3px] ${ink} rounded-[2px] ${
                    d.status === "F" ? "bg-free" : d.status === "P" ? "hatch" : ""
                  }`}
                />
                {isSelected && (
                  <span aria-hidden className="absolute inset-0 rounded-[3px] ring-[2.5px] ring-inset ring-red" />
                )}
              </>
            );
            const base = `relative flex flex-1 flex-col items-center gap-0.5 ${di === 0 && si === 0 ? "" : ""}`;
            return interactive ? (
              <button
                key={d.iso}
                type="button"
                title={cellLabel}
                aria-label={cellLabel}
                aria-pressed={isSelected}
                onClick={() => onPick?.(d.iso, d.status)}
                className={`${base} cursor-pointer transition-colors hover:bg-ink/[0.07] focus-visible:z-10 focus-visible:outline-offset-[-2px]`}
              >
                {inner}
              </button>
            ) : (
              <span key={d.iso} className={base} title={cellLabel}>
                {inner}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function RuleLegend({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2 ${className}`}>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="h-2.5 w-5 rounded-[2px] bg-free" /> свободен
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="hatch h-2.5 w-5 rounded-[2px] ring-1 ring-inset ring-free/40" /> частично
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="h-2.5 w-5 rounded-[2px] bg-rule ring-1 ring-inset ring-ink/30" /> зает
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="numerals text-red">7</span> днес
      </li>
    </ul>
  );
}
