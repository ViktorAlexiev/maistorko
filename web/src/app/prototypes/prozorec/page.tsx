import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Scenario } from "./data";
import { ProzorecProto } from "./proto";

export const metadata: Metadata = { title: "Проба: прозорецът в профила", robots: { index: false } };

/**
 * Planning prototype for the chat window on a craftsman's profile: the first message with photos in three variants
 * (Формуляр, Като в разговора, Писмо) and the conversation in „Тихо“ (the same in all three). All state local, nothing saved. Not reachable in production.
 * ?v=1|2|3 picks the variant, ?s=1|2|3|4 the scenario.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ v?: string; s?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const pick = (x: string | undefined, max: number) => Math.min(Math.max(Number.parseInt(x ?? "1", 10) || 1, 1), max);
  return <ProzorecProto initialVariant={pick(sp.v, 3) - 1} initialScenario={pick(sp.s, 4) as Scenario} />;
}
