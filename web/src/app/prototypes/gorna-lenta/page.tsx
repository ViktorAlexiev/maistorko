import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomePage from "@/app/page";
import { VariantIndeks } from "../tablo-nav/variant-indeks";
import { HfVariants } from "./variants";

export const metadata: Metadata = { title: "Проба: горна лента и футър", robots: { index: false } };

/**
 * Approved design „Светла лента“ for the site header and footer without thin lines, plus the menus that open from
 * the header (docs/plans/2026-11-12-osnova-na-tabloto.md). The real SiteHeader and SiteFooter from the root layout
 * are restyled from ./proto.css, around real content: the home page (default) or the approved dashboard frame (?s=tablo).
 * Planning prototype: not reachable in production and deleted by the plan's last task.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  return (
    <>
      <HfVariants />
      {sp.s === "tablo" ? <VariantIndeks /> : <HomePage />}
    </>
  );
}
