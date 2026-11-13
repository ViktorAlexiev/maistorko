import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PARTS, type PartKey } from "./data";
import { VariantStranitsi } from "./variant-stranitsi";

export const metadata: Metadata = { title: "Проба: „Профил“ на части", robots: { index: false } };

/**
 * Approved design for „Профил“ на части: the „Страници“ layout with „Плочки“ separation (docs/plans/2026-11-12-osnova-na-tabloto.md).
 * Planning prototype: not reachable in production and deleted by the plan's last task.
 * ?chast=kakvo|kade|kontakti|danni opens a part straight away.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ chast?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const part: PartKey | undefined = PARTS.find((p) => p.key === sp.chast)?.key;
  return <VariantStranitsi part={part} />;
}
