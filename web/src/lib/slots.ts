// Parts of the day, shared by the public calendar, the first message and chat.
// Windows match the search filter (search_craftsmen / time_window in SQL).

export type Slot = "morning" | "afternoon" | "evening";
export type Range = { start: string; end: string };

export const SLOT_DEFS: { key: Slot; label: string; hint: string; from: number; to: number }[] = [
  { key: "morning", label: "Сутрин", hint: "до 12 ч.", from: 6 * 60, to: 12 * 60 },
  { key: "afternoon", label: "Следобед", hint: "12–17 ч.", from: 12 * 60, to: 17 * 60 },
  { key: "evening", label: "Вечер", hint: "след 17 ч.", from: 17 * 60, to: 22 * 60 },
];

export const minutes = (t: string) => {
  if (t.startsWith("24")) return 24 * 60;
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + (m || 0);
};

/** The free part of a slot on a given day, e.g. "08:00–12:00", or null if none. */
export function freeInSlot(ranges: Range[], slot: Slot): string | null {
  const def = SLOT_DEFS.find((s) => s.key === slot)!;
  const parts = ranges
    .map((r) => [Math.max(minutes(r.start), def.from), Math.min(minutes(r.end), def.to)] as const)
    .filter(([a, b]) => b - a >= 30);
  if (!parts.length) return null;
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return parts.map(([a, b]) => `${fmt(a)}–${fmt(b)}`).join(", ");
}

/** Human label for a slot stored in message meta: "сутрин" or "09:00–11:00". */
export function slotLabel(slot: string | undefined | null): string | null {
  if (!slot) return null;
  const def = SLOT_DEFS.find((s) => s.key === slot);
  if (def) return `${def.label.toLowerCase()} (${def.hint})`;
  return slot.replace("-", "–");
}
