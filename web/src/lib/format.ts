// Formatting helpers: Bulgarian dates, EUR prices, units.

export const TZ = "Europe/Sofia";

export type PriceUnit = "job" | "hour" | "m2" | "piece" | "meter" | "day";
export type PriceKind = "fixed" | "from" | "quote";

export const UNIT_LABEL: Record<PriceUnit, string> = {
  job: "за услугата",
  hour: "на час",
  m2: "на м²",
  piece: "на брой",
  meter: "на л.м",
  day: "на ден",
};

export const UNIT_SHORT: Record<PriceUnit, string> = {
  job: "",
  hour: "/ч",
  m2: "/м²",
  piece: "/бр.",
  meter: "/л.м",
  day: "/ден",
};

export const UNIT_OPTIONS: { value: PriceUnit; label: string }[] = [
  { value: "job", label: "за услугата" },
  { value: "hour", label: "на час" },
  { value: "m2", label: "на м²" },
  { value: "piece", label: "на брой" },
  { value: "meter", label: "на линеен метър" },
  { value: "day", label: "на ден" },
];

const eur = new Intl.NumberFormat("bg-BG", { maximumFractionDigits: 2, minimumFractionDigits: 0 });

export function formatEur(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "";
  const n = typeof value === "string" ? Number(value) : value;
  return `${eur.format(n)} €`;
}

/** "от 25 €/ч", "от 150 €", "по оглед" */
export function headlinePrice(
  price: number | string | null | undefined,
  unit: PriceUnit | null | undefined,
  quote?: boolean | null,
) {
  if (price === null || price === undefined) return quote ? "по оглед" : "цена при запитване";
  return `от ${formatEur(price)}${unit ? UNIT_SHORT[unit] : ""}`;
}

export function servicePrice(kind: PriceKind, price: number | string | null, unit: PriceUnit) {
  if (kind === "quote" || price === null) return "по оглед";
  const base = `${formatEur(price)}${UNIT_SHORT[unit]}`;
  return kind === "from" ? `от ${base}` : base;
}

// ---------------------------------------------------------------------------
// Dates. All calendar logic uses plain YYYY-MM-DD strings in Sofia time.
// ---------------------------------------------------------------------------
export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

export function parseISO(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

/** ISO weekday: 1 = Monday ... 7 = Sunday */
export function isoWeekday(iso: string): number {
  const d = parseISO(iso).getUTCDay();
  return d === 0 ? 7 : d;
}

export function startOfWeekISO(iso: string): string {
  return addDaysISO(iso, 1 - isoWeekday(iso));
}

export const WEEKDAYS = ["понеделник", "вторник", "сряда", "четвъртък", "петък", "събота", "неделя"];
export const WEEKDAYS_SHORT = ["пн", "вт", "ср", "чт", "пт", "сб", "нд"];
export const WEEKDAYS_LETTER = ["П", "В", "С", "Ч", "П", "С", "Н"];
export const MONTHS = [
  "януари", "февруари", "март", "април", "май", "юни",
  "юли", "август", "септември", "октомври", "ноември", "декември",
];
export const MONTHS_SHORT = ["яну", "фев", "мар", "апр", "май", "юни", "юли", "авг", "сеп", "окт", "ное", "дек"];

/** Accusative-ish weekday phrase: "в понеделник", "във вторник", "в сряда" */
export function onWeekday(iso: string) {
  const w = WEEKDAYS[isoWeekday(iso) - 1];
  return w.startsWith("в") ? `във ${w}` : `в ${w}`;
}

/** "днес", "утре", "в сряда", "в сряда, 8 окт" */
export function relativeDay(iso: string | null | undefined, today = todayISO()): string {
  if (!iso) return "";
  const diff = diffDays(today, iso);
  if (diff === 0) return "днес";
  if (diff === 1) return "утре";
  if (diff > 1 && diff < 7) return onWeekday(iso);
  const d = parseISO(iso);
  return `${onWeekday(iso)}, ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

export function formatDate(iso: string, withWeekday = false) {
  const d = parseISO(iso);
  const base = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  return withWeekday ? `${WEEKDAYS[isoWeekday(iso) - 1]}, ${base}` : base;
}

export function formatDateTime(ts: string) {
  return new Date(ts).toLocaleString("bg-BG", {
    timeZone: TZ,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString("bg-BG", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

/** Fractional days since a timestamp. */
export function daysSince(ts: string, now = Date.now()) {
  return (now - new Date(ts).getTime()) / 86_400_000;
}

export function timeAgo(ts: string) {
  const s = Math.round((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60) return "току-що";
  const m = Math.round(s / 60);
  if (m < 60) return `преди ${m} мин`;
  const h = Math.round(m / 60);
  if (h < 24) return `преди ${h} ч`;
  const d = Math.round(h / 24);
  if (d === 1) return "вчера";
  if (d < 30) return `преди ${d} дни`;
  const mo = Math.round(d / 30);
  return mo === 1 ? "преди месец" : `преди ${mo} месеца`;
}

export function pluralBg(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export const LANGUAGE_LABEL: Record<string, string> = {
  bg: "български",
  en: "английски",
  ru: "руски",
  de: "немски",
  tr: "турски",
  ro: "румънски",
  el: "гръцки",
};
