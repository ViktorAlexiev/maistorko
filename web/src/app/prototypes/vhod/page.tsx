import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCities } from "@/lib/data";
import { todayISO } from "@/lib/format";
import { Proto } from "./proto";
import type { Screen } from "./shared";

export const metadata: Metadata = { title: "Проба: вход и регистрация", robots: { index: false } };

/**
 * Approved design for the side column of the login and registration pages: the „Метър“ variant
 * (docs/plans/2026-11-12-osnova-na-tabloto.md, piece 4).
 * Planning prototype: not reachable in production and deleted by the plan's last task.
 * ?s=vhod|klient|maistor picks the screen; the role choice and the links inside the forms switch it too.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const screen: Screen = sp.s === "klient" || sp.s === "maistor" ? sp.s : "vhod";
  const cities = await getCities();
  return <Proto screen={screen} cities={cities} today={todayISO()} />;
}
