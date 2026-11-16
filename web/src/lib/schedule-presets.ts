// The three ready-made weekly schedules, shared by the Calendar quick buttons and the setup page.
// Used from client and server code alike, so no "server-only" here.

import { endMin, normalize, toMin, toTime, type Interval } from "@/lib/intervals";

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

/** The week as seven lists of intervals: index 0 = Пн … 6 = Нд */
export type Week = Interval[][];

/** Schedule rows (weekday 1 = Пн, "HH:MM" or "HH:MM:SS", an end of "24:00" is the end of the day) as a week */
export function rulesToWeek(rules: { weekday: number; start_time: string; end_time: string }[]): Week {
  const week: Week = Array.from({ length: 7 }, () => []);
  for (const r of rules) {
    if (r.weekday < 1 || r.weekday > 7) continue;
    week[r.weekday - 1].push([toMin(r.start_time.slice(0, 5)), endMin(r.end_time.slice(0, 5))]);
  }
  return week.map(normalize);
}

/** A week as schedule rows, one per interval; the end of the day is written "24:00" */
export function weekToRules(week: Week): PresetRule[] {
  return week.flatMap((list, i) =>
    list.map(([a, b]) => ({ weekday: i + 1, start_time: toTime(a), end_time: b === 1440 ? "24:00" : toTime(b) })),
  );
}

/** A ready schedule as „the intervals of weekday wd (1 = Пн)“ */
const presetDay = (p: SchedulePreset) => (wd: number): Interval[] =>
  normalize(p.rules.filter((r) => r.weekday === wd).map((r): Interval => [toMin(r.start_time), endMin(r.end_time)]));

/** A ready schedule as seven lists of intervals, Пн…Нд */
export const presetWeek = (p: SchedulePreset): Week => Array.from({ length: 7 }, (_, i) => presetDay(p)(i + 1));
