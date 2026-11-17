import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Scenario } from "./data";
import { RazgovorProto } from "./proto";

export const metadata: Metadata = { title: "Проба: „Разговорът“", robots: { index: false } };

/**
 * Planning prototype for „Съобщения“: „Един лист“ (the „Тихо“ conversation with the list of conversations on one sheet; on a phone the list
 * looks like „Приложение“), six scenarios. All state local, nothing saved. Not reachable in production.
 * ?s=1|2|3|4|5|6 picks the scenario.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const s = Math.min(Math.max(Number.parseInt(sp.s ?? "1", 10) || 1, 1), 6) as Scenario;
  return <RazgovorProto initialScenario={s} />;
}
