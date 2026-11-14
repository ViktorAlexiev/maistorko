import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";
import { DashboardBottomBar } from "@/components/dashboard-bottom-bar";
import { dashboardNav, type NavItem } from "@/lib/dashboard-nav";
import { VariantKutii } from "./variant-kutii";

export const metadata: Metadata = { title: "Проба: „Цени и услуги“", robots: { index: false } };

/**
 * Approved design „Кутии“ for „Цени и услуги“: a price box per checked subcategory (docs/plans/2026-11-14-tseni.md, piece 1).
 * Planning prototype: not reachable in production and deleted by the plan's last task.
 * ?plan=pro shows the page as Pro sees it (colleagues' prices, no limit); ?pulno=1 starts with the free plan full (8 of 8).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ plan?: string; pulno?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  // The real dashboard frame; „Цени и услуги“ points here so it is the current item
  const here = (it: NavItem) => (it.href === "/tabla/tseni" ? { ...it, href: "/prototypes/tseni" } : it);
  const nav = dashboardNav({ craftsmanSlug: "georgi-petrov", inOrg: false });
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <DashboardNav groups={nav.groups.map((g) => g.map(here))} publicHref={nav.publicHref} unread={null} phoneRow={false} />
        <div className="min-w-0">
          <VariantKutii pro={sp.plan === "pro"} full={sp.pulno === "1" && sp.plan !== "pro"} />
        </div>
      </div>
      <DashboardBottomBar bar={nav.bar.map(here)} more={nav.more.map((g) => g.map(here))} publicHref={nav.publicHref} unread={null} />
    </div>
  );
}
