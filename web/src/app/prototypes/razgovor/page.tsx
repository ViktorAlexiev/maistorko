import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RazgovorProto } from "./proto";

export const metadata: Metadata = { title: "Проба: „Разговорът“", robots: { index: false } };

/**
 * Planning prototype for the chat thread in „Съобщения“: three variants (Тихо, Талон, Прозорец) of the same conversation,
 * three scenarios, all state local, nothing saved. Not reachable in production.
 * ?v=1|2|3 picks the variant, ?s=1|2|3 the scenario.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ v?: string; s?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const pick = (x: string | undefined) => Math.min(Math.max(Number.parseInt(x ?? "1", 10) || 1, 1), 3);
  return <RazgovorProto initialVariant={pick(sp.v) - 1} initialScenario={pick(sp.s) as 1 | 2 | 3} />;
}
