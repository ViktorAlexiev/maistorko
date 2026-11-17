import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Scenario } from "./data";
import { ProzorecProto } from "./proto";

export const metadata: Metadata = { title: "Проба: прозорецът в профила", robots: { index: false } };

/**
 * Planning prototype for the chat window on a craftsman's profile: the first message „Като в разговора“ (s=1, s=2)
 * and the window's conversation in two looks (s=3, s=4): ?v=1 „Днес“ (the production window as it is now), ?v=2 „Тихо“.
 * In s=1 and s=2 there is no switch and v is ignored. ?s=1|2|3|4 picks the scenario. All state local, nothing saved. Not reachable in production.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ v?: string; s?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const pick = (x: string | undefined, max: number) => Math.min(Math.max(Number.parseInt(x ?? "1", 10) || 1, 1), max);
  return <ProzorecProto initialVariant={pick(sp.v, 2) - 1} initialScenario={pick(sp.s, 4) as Scenario} />;
}
