import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardBottomBar } from "@/components/dashboard-bottom-bar";
import { getMyOrg } from "@/lib/org";
import { dashboardNav } from "@/lib/dashboard-nav";
import { ConversationSidebar } from "./conversation-sidebar";
import type { ConversationSummary } from "@/components/conversation-list";

export const metadata: Metadata = { title: "Съобщения", robots: { index: false } };

export default async function MessagesLayout({ children }: LayoutProps<"/saobshtenia">) {
  const viewer = await requireViewer("/saobshtenia");
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_conversations");
  const [org, { data: unreadTotal }] = await Promise.all([getMyOrg(), supabase.rpc("unread_total")]);
  const nav = dashboardNav({ craftsmanSlug: viewer.craftsmanSlug, inOrg: Boolean(org) });
  const unread = { userId: viewer.id, initial: unreadTotal ?? 0 };

  return (
    <div className="mx-auto max-w-7xl px-0 sm:px-6 sm:py-6">
      <div className="grid h-[calc(100dvh-4rem)] overflow-hidden sm:h-[calc(100dvh-7rem)] md:grid-cols-[22rem_minmax(0,1fr)]">
        <ConversationSidebar userId={viewer.id} initial={(data ?? []) as ConversationSummary[]} />
        {children}
      </div>
      <DashboardBottomBar bar={nav.bar} more={nav.more} publicHref={nav.publicHref} unread={unread} />
    </div>
  );
}
