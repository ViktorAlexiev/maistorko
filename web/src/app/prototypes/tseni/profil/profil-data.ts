/**
 * Demo data for the public profile prototype: the same electrician as the „Цени и услуги“ prototype (../data.ts),
 * plus one ready-made job left „по оглед“ so the „≈ X €“ estimate shows. Planning only, never imported by product code.
 */
import { GROUPS, SERVICES, TERMS, type Box, type Group, type Service, type Terms, type Unit } from "../data";
import { formatEur } from "@/lib/format";

export const PERSON = {
  name: "Георги Петров",
  firstName: "Георги",
  slug: "georgi-petrov",
  city: "София",
  years: 14,
  rating: 4.67,
  ratingCount: 3,
  bio: "Правоспособен електротехник с 14 години опит в жилищни и офис инсталации. Подменям табла, правя нови линии, монтирам осветление. Работя чисто и оставям схема на таблото.",
};

/** „Монтаж на вентилатор“ from the ready-made list, without a price: its box is 25 €/ч, so clients see „≈ 40 €“. */
const FAN: Service = { id: "s9", name: "Монтаж на вентилатор", kind: "quote", price: "", unit: "job", catId: 21, description: "", templateId: 107 };

/** ?dve=1: a second top category, to show how the groups read when there is more than one. */
const SECOND: Group = {
  name: "Майстор за всичко",
  hint: { hourly: [15, 25], job: [20, 60], scope: "city" },
  boxes: [{ id: 31, name: "Монтаж и окачване", kind: "from", price: "30", unit: "job" }],
};
const SECOND_SERVICES: Service[] = [
  { id: "s10", name: "Окачване на телевизор на стена", kind: "fixed", price: "40", unit: "job", catId: 31, description: "до 65 инча, стойката е на клиента" },
];

export function profileData(two: boolean) {
  const groups = two ? [...GROUPS, SECOND] : GROUPS;
  const services = two ? [...SERVICES, FAN, ...SECOND_SERVICES] : [...SERVICES, FAN];
  const terms: Terms = { ...TERMS, quoteOnInspection: true };
  return { groups, services, terms, headline: headline(groups.flatMap((g) => g.boxes), services) };
}

export type ProfileData = ReturnType<typeof profileData>;

const UNIT_SHORT: Record<Unit, string> = { job: "", hour: "/ч", m2: "/м²", piece: "/бр.", meter: "/л.м", day: "/ден" };

/** The headline price by the plan's rule: the lowest of the boxes and services, those „за услугата“ first. */
function headline(boxes: Box[], services: Service[]): string {
  const items = [
    ...boxes.filter((b) => b.kind && b.kind !== "quote").map((b) => ({ price: Number(b.price), unit: b.kind === "hour" ? ("hour" as Unit) : b.unit })),
    ...services.filter((s) => s.kind !== "quote").map((s) => ({ price: Number(s.price), unit: s.unit })),
  ].filter((x) => x.price > 0);
  const perJob = items.filter((x) => x.unit === "job");
  const pool = perJob.length ? perJob : items;
  if (!pool.length) return "по оглед";
  const low = pool.reduce((a, b) => (b.price < a.price ? b : a));
  return `от ${formatEur(low.price)}${UNIT_SHORT[low.unit]}`;
}
