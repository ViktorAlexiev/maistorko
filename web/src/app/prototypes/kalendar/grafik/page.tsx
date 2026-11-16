import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";
import { DashboardBottomBar } from "@/components/dashboard-bottom-bar";
import { dashboardNav, type NavItem } from "@/lib/dashboard-nav";
import { todayISO } from "@/lib/format";
import { GrafikProto } from "./proto";

export const metadata: Metadata = { title: "Проба: „Редовен график“", robots: { index: false } };

/**
 * Planning prototype for the „Редовен график“ box of the craftsman's „Календар“ (the page is the approved „Метър“):
 * three designs, all state local, nothing saved. Not reachable in production.
 * ?v=1..3 starts on a variant, ?nov=1 shows the first-time form of the variant, ?chas=HH:MM sets the demo „now“ (default 16:40).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ v?: string; nov?: string; chas?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const v = Math.min(3, Math.max(1, Number(sp.v) || 1));
  const chas = sp.chas && /^([01]?\d|2[0-3]):[0-5]\d$/.test(sp.chas) ? sp.chas : "16:40";
  // The real dashboard frame; „Календар“ points here so it is the current item
  const here = (it: NavItem) => (it.href === "/tabla/kalendar" ? { ...it, href: "/prototypes/kalendar/grafik" } : it);
  const nav = dashboardNav({ craftsmanSlug: "georgi-petrov", inOrg: false });
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <DashboardNav groups={nav.groups.map((g) => g.map(here))} publicHref={nav.publicHref} unread={null} phoneRow={false} />
        <div className="min-w-0">
          <GrafikProto v={v} nov={sp.nov === "1"} chas={chas} today={todayISO()} />
        </div>
      </div>
      <DashboardBottomBar bar={nav.bar.map(here)} more={nav.more.map((g) => g.map(here))} publicHref={nav.publicHref} unread={null} />
    </div>
  );
}
