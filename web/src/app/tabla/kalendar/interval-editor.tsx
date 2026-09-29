"use client";

import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  add,
  covers,
  firstGap,
  fromRows,
  newRow,
  parseEnd,
  parseStart,
  rowOk,
  SLOTS,
  subtract,
  toRows,
  toTime,
  type Row,
} from "@/lib/intervals";

/** Morning / afternoon / evening toggles over a list of rows. */
export function SlotChips({ rows, onChange, label }: { rows: Row[]; onChange: (rows: Row[]) => void; label?: string }) {
  const list = fromRows(rows);
  return (
    <>
      {SLOTS.map((s) => {
        const on = covers(list, s.iv);
        return (
          <button
            key={s.key}
            type="button"
            className="chip min-w-24 flex-col gap-0 py-1.5 leading-tight"
            aria-pressed={on}
            aria-label={`${label ? `${label}: ` : ""}${s.label} ${s.hint}`}
            onClick={() => onChange(toRows(on ? subtract(list, s.iv) : add(list, s.iv)))}
          >
            <span>{s.label}</span>
            <span className="text-xs font-medium opacity-75">{s.hint}</span>
          </button>
        );
      })}
    </>
  );
}

/** Exact from–to rows. Rows keep their order and values while typing; they're merged only when saved. */
export function RowList({ rows, onChange, idPrefix }: { rows: Row[]; onChange: (rows: Row[]) => void; idPrefix: string }) {
  const set = (key: number, patch: Partial<Row>) => onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const overlaps = (r: Row) =>
    rowOk(r) && rows.some((o) => o.key !== r.key && rowOk(o) && o.a < r.b && r.a < o.b);

  function addRow() {
    const gap = firstGap(fromRows(rows));
    if (!gap) return void toast.error("Няма място за още интервал между 06 и 23 ч. Промени някой от съществуващите.");
    onChange([...rows, newRow(gap)]);
  }

  return (
    <div className="grid gap-2">
      {rows.length === 0 && <p className="text-sm text-ink-3">Няма интервали: денят е почивен.</p>}
      {rows.map((r) => {
        const bad = !rowOk(r);
        return (
          <div key={r.key}>
            <div className="flex items-end gap-2">
              <div className="flex-1 sm:flex-none">
                <label className="text-xs font-semibold text-ink-2" htmlFor={`${idPrefix}-${r.key}-a`}>
                  От
                </label>
                <input
                  id={`${idPrefix}-${r.key}-a`}
                  type="time"
                  step={900}
                  className="field mt-0.5"
                  value={Number.isFinite(r.a) ? toTime(r.a) : ""}
                  aria-invalid={bad}
                  onChange={(e) => set(r.key, { a: parseStart(e.target.value) })}
                />
              </div>
              <div className="flex-1 sm:flex-none">
                <label className="text-xs font-semibold text-ink-2" htmlFor={`${idPrefix}-${r.key}-b`}>
                  До
                </label>
                <input
                  id={`${idPrefix}-${r.key}-b`}
                  type="time"
                  step={900}
                  className="field mt-0.5"
                  value={Number.isFinite(r.b) ? toTime(r.b % (24 * 60)) : ""}
                  aria-invalid={bad}
                  onChange={(e) => set(r.key, { b: parseEnd(e.target.value) })}
                />
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label="Премахни интервала"
                onClick={() => onChange(rows.filter((o) => o.key !== r.key))}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
            {bad ? (
              <p className="error-text mt-1">Краят трябва да е след началото.</p>
            ) : overlaps(r) ? (
              <p className="mt-1 text-sm text-ink-3">Застъпва се с друг интервал: при запис ще ги слеем в един.</p>
            ) : null}
          </div>
        );
      })}
      <button type="button" className="btn btn-outline btn-sm justify-self-start" onClick={addRow}>
        <Plus className="size-4" aria-hidden /> Добави интервал
      </button>
    </div>
  );
}
