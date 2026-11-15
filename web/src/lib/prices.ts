// Shared price helpers: the box (price per subcategory) and service price text, and the "≈ X €" estimate.
// No "server-only": client components use it too.
import { formatEur, UNIT_SHORT, type PriceKind, type PriceUnit } from "@/lib/format";

export type BoxKind = "fixed" | "from" | "hour" | "quote";

export const BOX_KINDS: readonly { k: BoxKind; label: string }[] = [
  { k: "fixed", label: "Точна цена" },
  { k: "from", label: "От … €" },
  { k: "hour", label: "На час" },
  { k: "quote", label: "По оглед" },
];

export const BOX_UNITS: readonly { value: PriceUnit; label: string }[] = [
  { value: "job", label: "за работа" },
  { value: "m2", label: "на м²" },
  { value: "piece", label: "на брой" },
  { value: "meter", label: "на линеен метър" },
  { value: "day", label: "на ден" },
];

/** The price as clients see it: "25 €/ч", "от 30 €", "15 €/бр.", "12 €", "по оглед". null = no price. */
export function priceText(
  kind: BoxKind | PriceKind | null,
  price: number | string | null | undefined,
  unit: PriceUnit,
): string | null {
  if (kind === null) return null;
  if (kind === "quote") return "по оглед";
  if (price === null || price === undefined || price === "") return null;
  const n = typeof price === "string" ? Number(price.replace(",", ".")) : price;
  if (!Number.isFinite(n)) return null;
  if (kind === "hour") return `${formatEur(n)}/ч`;
  const base = `${formatEur(n)}${UNIT_SHORT[unit]}`;
  return kind === "from" ? `от ${base}` : base;
}

/** "≈ X €": only for an "hour" box; Math.round(rate × hours / 5) × 5; null otherwise and when the result is ≤ 0. */
export function hourEstimate(
  box: { kind: BoxKind | null; price: number | string | null } | null | undefined,
  typicalHours: number | string | null | undefined,
): number | null {
  if (!box || box.kind !== "hour") return null;
  if (box.price === null || box.price === "" || typicalHours === null || typicalHours === undefined || typicalHours === "") {
    return null;
  }
  const rate = typeof box.price === "string" ? Number(box.price.replace(",", ".")) : box.price;
  const hours = Number(typicalHours);
  if (!Number.isFinite(rate) || !Number.isFinite(hours)) return null;
  const est = Math.round((rate * hours) / 5) * 5;
  return est > 0 ? est : null;
}
