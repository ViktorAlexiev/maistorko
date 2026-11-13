import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { todayISO } from "@/lib/format";
import { VariantDni } from "./variant-dni";

export const metadata: Metadata = { title: "Проба: „Поръчки“", robots: { index: false } };

/**
 * Approved design for „Поръчки“ without thin lines: the „Дни“ layout, boxes under a yellow band, group names in the condensed face
 * (docs/plans/2026-11-12-osnova-na-tabloto.md, piece 3).
 * Planning prototype: not reachable in production and deleted by the plan's last task.
 * ?forma=1 opens the form for a new job straight away; ?plan=bezplaten shows the page as the free plan sees it.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ plan?: string; forma?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  return <VariantDni today={todayISO()} pro={sp.plan !== "bezplaten"} open={sp.forma === "1"} />;
}
