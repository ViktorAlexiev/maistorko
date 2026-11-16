import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";
import { DashboardBottomBar } from "@/components/dashboard-bottom-bar";
import { dashboardNav, type NavItem } from "@/lib/dashboard-nav";
import { todayISO } from "@/lib/format";
import { KalendarProto } from "./proto";

export const metadata: Metadata = { title: "Проба: „Календар“", robots: { index: false } };

/**
 * Planning prototype for the craftsman's „Календар“: the approved „Метър“ with the „Лента“ schedule, all state local, nothing saved.
 * Not reachable in production.
 * ?nov=1 shows a new craftsman without a schedule, ?chas=HH:MM sets the demo „now“ (default 16:40).
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ nov?: string; chas?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const chas = sp.chas && /^([01]?\d|2[0-3]):[0-5]\d$/.test(sp.chas) ? sp.chas : "16:40";
  // The real dashboard frame; „Календар“ points here so it is the current item
  const here = (it: NavItem) => (it.href === "/tabla/kalendar" ? { ...it, href: "/prototypes/kalendar" } : it);
  const nav = dashboardNav({ craftsmanSlug: "georgi-petrov", inOrg: false });
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <DashboardNav groups={nav.groups.map((g) => g.map(here))} publicHref={nav.publicHref} unread={null} phoneRow={false} />
        <div className="min-w-0">
          <KalendarProto nov={sp.nov === "1"} chas={chas} today={todayISO()} />
        </div>
      </div>
      <DashboardBottomBar bar={nav.bar.map(here)} more={nav.more.map((g) => g.map(here))} publicHref={nav.publicHref} unread={null} />
    </div>
  );
}
