"use client";

import { useRef } from "react";
import { Trash2 } from "lucide-react";
import { WEEKDAYS } from "@/lib/format";
import { newRow, rowOk, toTime, type Row } from "@/lib/intervals";
import { addRowTo, FirstScheduleFrame, PresetBar, SaveBar, ScheduleSection, useWeekDraft, type Kalendar } from "../shared";

/** What a day gets when it is switched on */
const defaultRows = (): Row[] => [newRow([8 * 60, 17 * 60])];

/** Every half hour from 05:00 to 24:00; an odd time that is already set stays selectable. */
const STEPS = Array.from({ length: 39 }, (_, i) => 300 + i * 30);

function TimeSelect({ value, onChange, label, invalid }: { value: number; onChange: (m: number) => void; label: string; invalid: boolean }) {
  const list = Number.isFinite(value) && !STEPS.includes(value) ? [...STEPS, value].sort((a, b) => a - b) : STEPS;
  return (
    <select
      className="field min-w-0 flex-1 px-2"
      aria-label={label}
      aria-invalid={invalid}
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
    >
      {!Number.isFinite(value) && <option value="">--</option>}
      {list.map((m) => (
        <option key={m} value={m}>
          {toTime(m)}
        </option>
      ))}
    </select>
  );
}

/** „Часовник“: display and editing are one surface, like an alarm-clock list. */
export function ChasovnikSchedule({ k }: { k: Kalendar }) {
  return <ChasovnikBody key={String(k.hasSchedule)} k={k} first={!k.hasSchedule} />;
}

function ChasovnikBody({ k, first }: { k: Kalendar; first: boolean }) {
  const d = useWeekDraft(k, first);
  // The hours of a day that was switched off, so switching it on again brings them back
  const memo = useRef<Record<number, Row[]>>({});
  const on = first ? "bg-surface" : "bg-paper";

  const toggle = (i: number, next: boolean) => {
    if (next) d.setDayRows(i, memo.current[i]?.length ? memo.current[i] : defaultRows());
    else {
      memo.current[i] = d.week[i];
      d.setDayRows(i, []);
    }
  };

  const list = (
    <div className="grid gap-4">
      <PresetBar onPick={d.applyPreset} onClear={d.clear} />
      <ul className="grid gap-1">
        {d.week.map((rows, i) => {
          const isOn = rows.length > 0;
          return (
            <li key={i} className={`rounded-[6px] p-3 sm:p-4 ${isOn ? on : "bg-surface-2 text-ink-3"}`}>
              <div className="flex min-h-11 items-center gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOn}
                  aria-label={WEEKDAYS[i]}
                  className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  onClick={() => toggle(i, !isOn)}
                >
                  <span className="relative inline-flex">
                    <span className={`h-7 w-12 rounded-full transition-colors ${isOn ? "bg-free" : "bg-line-strong"}`} />
                    <span className={`absolute left-1 top-1 size-5 rounded-full bg-white shadow transition-transform ${isOn ? "translate-x-5" : ""}`} />
                  </span>
                </button>
                <span className={`min-w-0 flex-1 font-extrabold capitalize ${isOn ? "" : "text-ink-3"}`}>{WEEKDAYS[i]}</span>
                {!isOn && <span className="text-sm font-bold">почивен</span>}
              </div>
              {isOn && (
                <div className="mt-2 grid gap-2">
                  {rows.map((r) => {
                    const bad = !rowOk(r);
                    const set = (patch: Partial<Row>) => d.setDayRows(i, rows.map((o) => (o.key === r.key ? { ...o, ...patch } : o)));
                    return (
                      <div key={r.key}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink-2">от</span>
                          <TimeSelect value={r.a} onChange={(a) => set({ a })} label={`${WEEKDAYS[i]}, от`} invalid={bad} />
                          <span className="text-sm font-semibold text-ink-2">до</span>
                          <TimeSelect value={r.b} onChange={(b) => set({ b })} label={`${WEEKDAYS[i]}, до`} invalid={bad} />
                          <button
                            type="button"
                            className="btn btn-ghost size-11 shrink-0 p-0"
                            aria-label={`${WEEKDAYS[i]}: премахни интервала`}
                            onClick={() => (rows.length > 1 ? d.setDayRows(i, rows.filter((o) => o.key !== r.key)) : toggle(i, false))}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </div>
                        {bad && <p className="error-text mt-1">Краят трябва да е след началото.</p>}
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap items-center gap-x-2">
                    <button type="button" className="btn btn-ghost min-h-11 px-2" onClick={() => addRowTo(rows, (r) => d.setDayRows(i, r))}>
                      + интервал
                    </button>
                    {i > 0 && (
                      <button type="button" className="btn btn-ghost min-h-11 px-2 underline underline-offset-4" onClick={() => d.copyDay(0, i)}>
                        Като понеделник
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );

  if (first) return <FirstScheduleFrame k={k} onSave={d.save}>{list}</FirstScheduleFrame>;
  return (
    <ScheduleSection>
      {list}
      {d.dirty && <SaveBar invalid={d.invalid} onCancel={d.reset} onSave={d.save} />}
    </ScheduleSection>
  );
}
