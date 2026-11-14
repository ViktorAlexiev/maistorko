import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RedProto } from "./proto";

export const metadata: Metadata = { title: "Проба: цената в реда на каталога", robots: { index: false } };

/**
 * The price and the matched service's name in a catalogue row (docs/plans/2026-11-14-tseni.md, interface piece 3),
 * approved variant „Под цената“. Planning prototype: not reachable in production and deleted by the plan's last task.
 * ?q=2 switches to the second search preset („теч“: a subcategory match and a „по оглед“ match).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  return <RedProto preset={sp.q === "2" ? 2 : 1} />;
}
