import { notFound } from "next/navigation";
import { getCategoryTree, getCities } from "@/lib/data";
import { SetapProto } from "./proto";

export const metadata = { title: "Проба: сетъп", robots: { index: false } };

/**
 * Planning prototype of the first setup after registration (docs/plans/2026-11-14-setap.md).
 * Not reachable in production. Local state only, nothing is saved.
 * Approved variant „Фокус“. ?stapka=1..5 first step, ?demo=ready|part starts with saved data.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ stapka?: string; demo?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const [tree, cities] = await Promise.all([getCategoryTree(), getCities()]);
  return <SetapProto tree={tree} cities={cities} stapka={sp.stapka} demo={sp.demo} />;
}
