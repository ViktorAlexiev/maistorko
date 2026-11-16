import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { todayISO } from "@/lib/format";
import { KogaProto } from "./proto";

export const metadata: Metadata = { title: "Проба: „Кога си свободен?“", robots: { index: false } };

/**
 * Planning prototype for setup step 4 „Кога си свободен?“ in the approved „Лента“ look, all state local, nothing saved.
 * Not reachable in production. ?ima=1: a craftsman who already has a saved schedule.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ ima?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  return <KogaProto has={sp.ima === "1"} today={todayISO()} />;
}
