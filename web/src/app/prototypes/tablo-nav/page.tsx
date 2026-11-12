import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VariantIndeks } from "./variant-indeks";

export const metadata: Metadata = { title: "Проба: навигация на таблото", robots: { index: false } };

/**
 * Approved design „Индекс“ for the dashboard navigation (docs/plans/2026-11-12-osnova-na-tabloto.md).
 * Planning prototype: not reachable in production and deleted by the plan's last task.
 */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <VariantIndeks />;
}
