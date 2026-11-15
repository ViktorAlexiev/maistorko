import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";
import { DashboardBottomBar } from "@/components/dashboard-bottom-bar";
import { dashboardNav, type NavItem } from "@/lib/dashboard-nav";
import { TablaProto } from "./proto";

export const metadata: Metadata = {
  title: "Проба: „Първи стъпки“",
  robots: { index: false },
};

/**
 * Planning prototype of „Първи стъпки“ on /tabla (docs/plans/2026-11-14-setap.md, piece 2).
 * Approved variant „Метър“. Not reachable in production. ?sastoyanie=nov|chast|vidim picks what the craftsman has done.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ sastoyanie?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  // The real dashboard frame; „Табло“ points here so it is the current item
  const here = (it: NavItem) =>
    it.href === "/tabla" ? { ...it, href: "/prototypes/setap/tabla" } : it;
  const nav = dashboardNav({ craftsmanSlug: "georgi-petrov", inOrg: false });
  const state =
    sp.sastoyanie === "nov" || sp.sastoyanie === "vidim"
      ? sp.sastoyanie
      : "chast";
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <DashboardNav
          groups={nav.groups.map((g) => g.map(here))}
          publicHref={nav.publicHref}
          unread={null}
          phoneRow={false}
        />
        <div className="min-w-0">
          <TablaProto state={state} />
        </div>
      </div>
      <DashboardBottomBar
        bar={nav.bar.map(here)}
        more={nav.more.map((g) => g.map(here))}
        publicHref={nav.publicHref}
        unread={null}
      />
    </div>
  );
}
