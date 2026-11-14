import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfilProto } from "./proto";

export const metadata: Metadata = { title: "Проба: цените в профила", robots: { index: false } };

/**
 * The „Цени“ section of the public profile, approved variant „Кутии“ (docs/plans/2026-11-14-tseni.md, piece 2).
 * Planning prototype: not reachable in production and deleted by the plan's last task.
 * ?dve=1 adds a second top category (the top categories' names then show above their boxes).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ dve?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  return <ProfilProto two={sp.dve === "1"} />;
}
