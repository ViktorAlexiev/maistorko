import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { todayISO } from "@/lib/format";
import { VariantDni } from "./variant-dni";

export const metadata: Metadata = { title: "Проба: „Поръчки“", robots: { index: false } };

/**
 * Approved design for „Поръчки“ without thin lines: the „Дни“ variant (docs/plans/2026-11-12-osnova-na-tabloto.md, piece 3).
 * Planning prototype: not reachable in production and deleted by the plan's last task.
 * ?plan=bezplaten shows the page as the free plan sees it (the Pro parts locked).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  return <VariantDni today={todayISO()} pro={sp.plan !== "bezplaten"} />;
}
