import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RazgovorProto } from "./proto";

export const metadata: Metadata = { title: "Проба: „Разговорът“", robots: { index: false } };

/**
 * Planning prototype for „Съобщения“: the „Тихо“ conversation together with the list of conversations, in three compositions
 * (Един лист, Показалец, Приложение) with three offer cards, four scenarios. All state local, nothing saved. Not reachable in production.
 * ?v=1|2|3 picks the variant, ?s=1|2|3|4 the scenario.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ v?: string; s?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const pick = (x: string | undefined, max: number) => Math.min(Math.max(Number.parseInt(x ?? "1", 10) || 1, 1), max);
  return <RazgovorProto initialVariant={pick(sp.v, 3) - 1} initialScenario={pick(sp.s, 4) as 1 | 2 | 3 | 4} />;
}
