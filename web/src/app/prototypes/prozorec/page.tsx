import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { Scenario } from "./data";
import { ProzorecProto } from "./proto";

export const metadata: Metadata = { title: "Проба: прозорецът в профила", robots: { index: false } };

/**
 * Planning prototype for the chat window on a craftsman's profile, as approved: the first message „Като в разговора“ (s=1, s=2)
 * and the window's conversation in „Тихо“ (s=3, s=4). ?s=1|2|3|4 picks the scenario. All state local, nothing saved. Not reachable in production.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const n = Number.parseInt(sp.s ?? "1", 10) || 1;
  return <ProzorecProto initialScenario={Math.min(Math.max(n, 1), 4) as Scenario} />;
}
