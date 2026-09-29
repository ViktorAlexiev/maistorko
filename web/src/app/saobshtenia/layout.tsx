import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ConversationSidebar } from "./conversation-sidebar";
import type { ConversationSummary } from "@/components/conversation-list";

export const metadata: Metadata = { title: "Съобщения", robots: { index: false } };

export default async function MessagesLayout({ children }: LayoutProps<"/saobshtenia">) {
  const viewer = await requireViewer("/saobshtenia");
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_conversations");

  return (
    <div className="mx-auto max-w-7xl px-0 sm:px-6 sm:py-6">
      <div className="grid h-[calc(100dvh-4rem)] overflow-hidden border-line bg-surface sm:h-[calc(100dvh-7rem)] sm:rounded-[12px] sm:border md:grid-cols-[22rem_minmax(0,1fr)]">
        <ConversationSidebar userId={viewer.id} initial={(data ?? []) as ConversationSummary[]} />
        {children}
      </div>
    </div>
  );
}
