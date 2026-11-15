// The three ready-made weekly schedules, shared by the Calendar quick buttons and the setup page.
// Used from client and server code alike, so no "server-only" here.

export type SchedulePresetId = "weekdays" | "monsat" | "evenings";
export type PresetRule = { weekday: number; start_time: string; end_time: string }; // weekday 1 = Пн … 7 = Нд; "08:00"
export type SchedulePreset = {
  id: SchedulePresetId;
  label: string; // "Пн–Пт 8–17"
  days: boolean[]; // 7 values, Пн…Нд: is the day a working day
  hours: string; // "Пн до Пт от 08:00 до 17:00"
  rules: PresetRule[];
};

// Rows for the weekdays from..to (inclusive), all with the same hours.
const span = (from: number, to: number, start_time: string, end_time: string): PresetRule[] =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ weekday: from + i, start_time, end_time }));

const daysOf = (rules: PresetRule[]) =>
  Array.from({ length: 7 }, (_, i) => rules.some((r) => r.weekday === i + 1));

const make = (id: SchedulePresetId, label: string, hours: string, rules: PresetRule[]): SchedulePreset => ({
  id,
  label,
  days: daysOf(rules),
  hours,
  rules,
});

export const SCHEDULE_PRESETS: readonly SchedulePreset[] = [
  make("weekdays", "Пн–Пт 8–17", "Пн до Пт от 08:00 до 17:00", span(1, 5, "08:00", "17:00")),
  make("monsat", "Пн–Сб 8–18", "Пн до Сб от 08:00 до 18:00", span(1, 6, "08:00", "18:00")),
  make("evenings", "Вечери и уикенд", "Пн до Пт от 17:00 до 20:30, Сб и Нд от 09:00 до 17:00", [
    ...span(1, 5, "17:00", "20:30"),
    ...span(6, 7, "09:00", "17:00"),
  ]),
];

// "08:00:00" (from the database) and "08:00" are the same time.
const key = (r: { weekday: number; start_time: string; end_time: string }) =>
  `${r.weekday} ${r.start_time.slice(0, 5)}-${r.end_time.slice(0, 5)}`;

// Which ready-made schedule these rows are exactly, regardless of row order and seconds; null if none.
export function matchPreset(
  rules: readonly { weekday: number; start_time: string; end_time: string }[],
): SchedulePresetId | null {
  if (rules.length === 0) return null;
  const got = rules.map(key).sort();
  for (const p of SCHEDULE_PRESETS) {
    const want = p.rules.map(key).sort();
    if (want.length === got.length && want.every((k, i) => k === got[i])) return p.id;
  }
  return null;
}
