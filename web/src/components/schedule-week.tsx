"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { RowList, SlotChips } from "@/app/tabla/kalendar/interval-editor";
import { WEEKDAYS } from "@/lib/format";
import { fromRows, rowOk, summary, toRows, type Interval, type Row } from "@/lib/intervals";
import { presetWeek, SCHEDULE_PRESETS, type SchedulePreset, type Week } from "@/lib/schedule-presets";

const emptyWeek = (): Week => Array.from({ length: 7 }, () => []);

/**
 * The week in rows while it is being edited.
 * Календар (a saved schedule): only the open day sheet edits it; „Готово“ saves, a quick schedule saves the whole week at once.
 * First schedule (empty Календар, setup): nothing is saved until `save()`.
 * `saved` must be stable (useMemo): the draft follows it when its reference changes.
 */
export function useWeekDraft({
  saved,
  first,
  saveWeek,
}: {
  saved: Week;
  first: boolean;
  saveWeek: (week: Week, msg?: { text: string; undo: Week }) => void;
}) {
  const [week, setWeek] = useState<Row[][]>(() => saved.map(toRows));
  // A save or „Върни“ changes the saved week: the rows follow it
  const [base, setBase] = useState(saved);
  if (base !== saved) {
    setBase(saved);
    setWeek(saved.map(toRows));
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
        : saveWeek(presetWeek(p), { text: `Графикът е сменен на „${p.label}“.`, undo: saved }),
    clear: () => setWeek(emptyWeek().map(toRows)),
    /** the draft is the saved week again */
    reset: () => setWeek(saved.map(toRows)),
    /** „Готово“ in the day sheet; false keeps the sheet open */
    done: () => {
      if (invalid) {
        toast.error("Има интервал, в който краят е преди началото.");
        return false;
      }
      if (!first && JSON.stringify(lists) !== JSON.stringify(saved)) saveWeek(lists);
      return true;
    },
    /** „Запази графика“ of the first schedule */
    save: () => {
      if (invalid) return void toast.error("Има интервал, в който краят е преди началото.");
      if (lists.every((l) => l.length === 0)) return void toast.error("Отбележи поне един работен ден.");
      saveWeek(lists);
    },
  };
}

export type WeekDraft = ReturnType<typeof useWeekDraft>;

/** „Бързо: Пн–Пт 8–17 · Пн–Сб 8–18 · Вечери и уикенд“, and „Изчисти“ where nothing is saved yet */
function PresetBar({ onPick, onClear }: { onPick: (p: SchedulePreset) => void; onClear?: () => void }) {
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

/** A new craftsman: the heading, the days, the same-day switch (`sameDay`) and the inline save button */
export function FirstScheduleFrame({ onSave, sameDay, children }: { onSave: () => void; sameDay: ReactNode; children: ReactNode }) {
  return (
    <section className="grid min-w-0 gap-5" aria-labelledby="first-h">
      <h2 id="first-h" className="display text-3xl sm:text-4xl">
        Още нямаш график. Кога обикновено работиш?
      </h2>
      {children}
      {sameDay}
      <button type="button" className="btn btn-primary btn-lg justify-self-start" onClick={onSave}>
        Запази графика
      </button>
    </section>
  );
}

/** The switch „Мога да дойда и в същия ден“; the caller saves it (at once in Календар, with the step in setup) */
export function SameDayToggle({ on, onChange, disabled }: { on: boolean; onChange: (on: boolean) => void; disabled?: boolean }) {
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
          checked={on}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-7 w-12 rounded-full bg-line-strong transition-colors peer-checked:bg-free peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink" />
        <span className="absolute left-1 top-1 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

const H0 = 6 * 60;
const H1 = 22 * 60;
const pct = (m: number) => ((Math.min(Math.max(m, H0), H1) - H0) / (H1 - H0)) * 100;
const MARKS = [6, 12, 18, 22];

/**
 * The quick schedules, the seven strips and the sheet of one weekday: the same piece in Календар and in setup step 4.
 * `first`: nothing is saved yet, so „Изчисти“ is offered.
 */
export function ScheduleWeek({ d, first, tone }: { d: WeekDraft; first: boolean; tone: "bg-surface" | "bg-paper" }) {
  const [open, setOpen] = useState<number | null>(null);
  // The rows when the sheet opened: closing it without „Готово“ goes back to them
  const before = useRef<Row[][]>(d.week);
  return (
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
      <DaySheetGrafik
        d={d}
        open={open}
        onClose={(done) => {
          if (!done) d.restore(before.current);
          setOpen(null);
        }}
      />
    </div>
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
function DaySheetGrafik({ d, open, onClose }: { d: WeekDraft; open: number | null; onClose: (done: boolean) => void }) {
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
