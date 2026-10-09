import { notFound } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Thread, type ChatMessage } from "./thread";
import type { Booking } from "./booking";
import type { Share } from "./chat-photos";

export default async function ConversationPage({ params }: PageProps<"/saobshtenia/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const viewer = await requireViewer(`/saobshtenia/${id}`);
  const supabase = await createClient();

  const { data: conv } = await supabase
    .from("conversations")
    .select("id, client_id, craftsman_id, requested_date, messages_purged_at, category:categories(name)")
    .eq("id", id)
    .maybeSingle();
  if (!conv) notFound();

  const [{ data: summaries }, { data: messages }, { data: phone }, { data: bookings }, { data: shares }] = await Promise.all([
    supabase.rpc("my_conversations"),
    supabase
      .from("messages")
      .select("id, sender_id, body, meta, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.rpc("conversation_partner_phone", { p_conversation: id }),
    supabase
      .from("bookings")
      .select("id, booking_date, end_date, start_time, end_time, kind, status, note, proposed_by, craftsman_id, client_id")
      .eq("conversation_id", id)
      .order("created_at"),
    supabase
      .from("photo_share_requests")
      .select("id, message_id, path, status, published_at, requested_by")
      .eq("conversation_id", id),
  ]);
  const summary = summaries?.find((s) => s.id === id);
  const category = Array.isArray(conv.category) ? conv.category[0] : conv.category;
  const iAmClient = conv.client_id === viewer.id;

  return (
    <Thread
      key={id}
      conversationId={id}
      me={viewer.id}
      iAmClient={iAmClient}
      partner={{
        id: iAmClient ? conv.craftsman_id : conv.client_id,
        name: summary?.partner_name ?? "Разговор",
        avatar: summary?.partner_avatar ?? null,
        slug: summary?.partner_slug ?? null,
        phone: phone ?? null,
      }}
      requestedDate={conv.requested_date}
      purgedAt={conv.messages_purged_at}
      categoryName={category?.name ?? null}
      initial={((messages ?? []) as ChatMessage[]).reverse()}
      initialBookings={(bookings ?? []) as Booking[]}
      initialShares={(shares ?? []) as Share[]}
      craftsmanId={conv.craftsman_id}
      banned={viewer.profile.is_banned}
    />
  );
}
