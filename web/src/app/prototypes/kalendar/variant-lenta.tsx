"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { RowList, SlotChips } from "@/app/tabla/kalendar/interval-editor";
import { WEEKDAYS } from "@/lib/format";
import { summary, type Interval, type Row } from "@/lib/intervals";
import { FirstScheduleFrame, PresetBar, ScheduleSection, useWeekDraft, type Kalendar } from "./shared";

const H0 = 6 * 60;
const H1 = 22 * 60;
const pct = (m: number) => ((Math.min(Math.max(m, H0), H1) - H0) / (H1 - H0)) * 100;
const MARKS = [6, 12, 18, 22];

/** „Лента“: the week as seven strips with a 06–22 track each; a tap on a strip opens that weekday in a sheet. */
export function LentaSchedule({ k }: { k: Kalendar }) {
  return <LentaBody key={String(k.hasSchedule)} k={k} first={!k.hasSchedule} />;
}

function LentaBody({ k, first }: { k: Kalendar; first: boolean }) {
  const d = useWeekDraft(k, first);
  const [open, setOpen] = useState<number | null>(null);
  // The rows when the sheet opened: closing it without „Готово“ goes back to them
  const before = useRef<Row[][]>(d.week);
  const tone = first ? "bg-surface" : "bg-paper";

  const strips = (
    <div className="grid gap-4">
      <PresetBar onPick={d.applyPreset} onClear={first ? d.clear : undefined} />
      <ul className="grid gap-1">
        {d.lists.map((list, i) => (
          <li key={i}>
            <button
              type="button"
              className={`block w-full min-w-0 rounded-[6px] ${tone} p-3 text-left transition-shadow hover:shadow-[var(--shadow-md)] sm:p-4`}
              onClick={() => {
                before.current = d.week;
                setOpen(i);
              }}
              aria-label={`${WEEKDAYS[i]}: ${summary(list)}. Промени`}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-extrabold capitalize">{WEEKDAYS[i]}</span>
                <span className={`numerals min-w-0 text-right text-lg ${list.length ? "" : "text-ink-3"}`}>{summary(list)}</span>
              </span>
              <Track list={list} marks={i === 0} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  const sheet = (
    <DaySheetGrafik
      d={d}
      open={open}
      onClose={(done) => {
        if (!done) d.restore(before.current);
        setOpen(null);
      }}
    />
  );

  if (first) {
    return (
      <FirstScheduleFrame k={k} onSave={d.save}>
        {strips}
        {sheet}
      </FirstScheduleFrame>
    );
  }
  return (
    <ScheduleSection help="Докосни ден, за да промениш часовете му.">
      {strips}
      {sheet}
    </ScheduleSection>
  );
}

/** A panel-surface track 06–22 with green blocks; the hour numerals only under the first one */
function Track({ list, marks }: { list: Interval[]; marks: boolean }) {
  return (
    <span className="mt-2 block" aria-hidden>
      <span className="relative block h-3 overflow-hidden rounded-full bg-surface-2">
        {list.map(([a, b]) => (
          <span key={a} className="absolute inset-y-0 rounded-full bg-free" style={{ left: `${pct(a)}%`, width: `${Math.max(pct(b) - pct(a), 1.5)}%` }} />
        ))}
      </span>
      {marks && (
        <span className="relative mt-1 block h-4">
          {MARKS.map((h) => (
            <span
              key={h}
              className={`numerals absolute text-sm leading-4 text-ink-3 ${h === H0 / 60 ? "" : h === H1 / 60 ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: `${pct(h * 60)}%` }}
            >
              {h}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/** The sheet of one weekday: „Готово“ keeps the change (and saves it in Календар), the cross or a tap outside drops it. */
function DaySheetGrafik({ d, open, onClose }: { d: ReturnType<typeof useWeekDraft>; open: number | null; onClose: (done: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const isDone = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open !== null && !el.open) {
      isDone.current = false;
      el.showModal();
    }
    if (open === null && el.open) el.close();
  }, [open]);
  const i = open ?? 0;
  const rows = d.week[i];

  return (
    <dialog ref={ref} className="sheet" aria-labelledby="lenta-day" onClose={() => onClose(isDone.current)} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      {open !== null && (
        <div className="safe-bottom grid gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="lenta-day" className="display text-4xl capitalize">
                {WEEKDAYS[i]}
              </h2>
              <p className="numerals mt-1 text-xl text-ink-2">{summary(d.lists[i])}</p>
            </div>
            <button type="button" className="btn btn-ghost size-11 p-0" onClick={() => ref.current?.close()} aria-label="Затвори">
              <X className="size-6" aria-hidden />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <SlotChips rows={rows} onChange={(r) => d.setDayRows(i, r)} label={WEEKDAYS[i]} />
            <button
              type="button"
              className="chip min-h-11 self-stretch"
              aria-pressed={rows.length === 0}
              onClick={() => d.setDayRows(i, [])}
            >
              Почивен ден
            </button>
          </div>
          <div className="rounded-[8px] bg-paper p-3">
            <p className="mb-2 text-sm font-bold">Точни часове</p>
            <RowList rows={rows} onChange={(r) => d.setDayRows(i, r)} idPrefix={`l${i}`} />
          </div>
          {i < 5 && (
            <button type="button" className="btn btn-ghost min-h-11 justify-self-start underline underline-offset-4" onClick={() => d.copyToWeekdays(i)}>
              Същите часове за всички делнични дни
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => {
              if (!d.done()) return;
              isDone.current = true;
              ref.current?.close();
            }}
          >
            Готово
          </button>
        </div>
      )}
    </dialog>
  );
}
