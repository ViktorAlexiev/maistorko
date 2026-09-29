// Minute-based interval arithmetic for the weekly schedule editor.

export type Interval = [number, number]; // [start, end) in minutes from midnight

export const toMin = (t: string) => {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
};

export const toTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function normalize(list: Interval[]): Interval[] {
  const sorted = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out: Interval[] = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export function add(list: Interval[], iv: Interval) {
  return normalize([...list, iv]);
}

export function subtract(list: Interval[], [s, e]: Interval): Interval[] {
  const out: Interval[] = [];
  for (const [a, b] of list) {
    if (b <= s || a >= e) out.push([a, b]);
    else {
      if (a < s) out.push([a, s]);
      if (b > e) out.push([e, b]);
    }
  }
  return normalize(out);
}

export function covers(list: Interval[], [s, e]: Interval) {
  return list.some(([a, b]) => a <= s && b >= e);
}

export function totalHours(list: Interval[]) {
  return list.reduce((sum, [a, b]) => sum + (b - a), 0) / 60;
}

export const SLOTS: { key: string; label: string; iv: Interval; hint: string }[] = [
  { key: "morning", label: "Сутрин", iv: [8 * 60, 12 * 60], hint: "8–12" },
  { key: "afternoon", label: "Следобед", iv: [12 * 60, 17 * 60], hint: "12–17" },
  { key: "evening", label: "Вечер", iv: [17 * 60, 20 * 60], hint: "17–20" },
];

export function summary(list: Interval[]) {
  if (!list.length) return "почивка";
  return list.map(([a, b]) => `${toTime(a)}–${toTime(b)}`).join(", ");
}

/** "24:00" (or "24:00:00") is the end of the day. */
export const endMin = (t: string) => (t.startsWith("24") ? 24 * 60 : toMin(t));

/**
 * Editable row. Rows stay exactly as typed while the user edits them (no sorting or merging),
 * so an intermediate value like start > end never makes a row disappear. They're normalised
 * only when read as intervals.
 */
export type Row = { key: number; a: number; b: number };

let rowSeq = 0;
export const toRows = (list: Interval[]): Row[] => list.map(([a, b]) => ({ key: ++rowSeq, a, b }));
export const newRow = ([a, b]: Interval): Row => ({ key: ++rowSeq, a, b });
export const rowOk = (r: Row) => Number.isFinite(r.a) && Number.isFinite(r.b) && r.b > r.a;
export const fromRows = (rows: Row[]) => normalize(rows.filter(rowOk).map((r) => [r.a, r.b] as Interval));

/** Parse a time input value; empty stays NaN. An end of 00:00 means midnight (24:00). */
export const parseStart = (v: string) => (v ? toMin(v) : NaN);
export const parseEnd = (v: string) => (v ? toMin(v) || 24 * 60 : NaN);

/** A free gap of at least `min` minutes between `from` and `to` (capped at 3 hours), preferring one after the last interval. */
export function firstGap(list: Interval[], min = 60, from = 6 * 60, to = 23 * 60): Interval | null {
  const gaps = complement(normalize(list))
    .map(([a, b]): Interval => [Math.max(a, from), Math.min(b, to)])
    .filter(([a, b]) => b - a >= min);
  const lastEnd = list.length ? Math.max(...list.map(([, b]) => b)) : 0;
  const g = gaps.find(([a]) => a >= lastEnd) ?? gaps[0];
  return g ? [g[0], Math.min(g[1], g[0] + 180)] : null;
}

/** Everything in the day that is not in `list`. */
export const complement = (list: Interval[]) => list.reduce<Interval[]>((acc, iv) => subtract(acc, iv), [[0, 24 * 60]]);
