import { createClient } from "@/lib/supabase/server";

/**
 * GDPR export: everything the signed-in person can see about themselves, as one JSON file.
 * It goes through the person's own session, so Row Level Security decides what is included.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const id = claims?.claims?.sub;
  if (!id) return new Response("Влезте в профила си.", { status: 401 });

  const all = async (table: string, column: string) => {
    const { data } = await supabase.from(table as never).select("*").eq(column, id).limit(5000);
    return data ?? [];
  };

  const conversations = (
    (await supabase.from("conversations").select("*").or(`client_id.eq.${id},craftsman_id.eq.${id}`).limit(2000)).data ?? []
  ) as { id: string }[];
  const messages = conversations.length
    ? ((await supabase.from("messages").select("*").in("conversation_id", conversations.map((c) => c.id)).order("created_at").limit(20000)).data ?? [])
    : [];

  const body = {
    exported_at: new Date().toISOString(),
    account: { id, email: claims?.claims?.email ?? null },
    profile: await all("profiles", "id"),
    craftsman_profile: await all("craftsman_profiles", "id"),
    categories: await all("craftsman_categories", "craftsman_id"),
    service_areas: await all("craftsman_service_areas", "craftsman_id"),
    services: await all("services", "craftsman_id"),
    work_photos: await all("work_photos", "craftsman_id"),
    availability_rules: await all("availability_rules", "craftsman_id"),
    availability_exceptions: await all("availability_exceptions", "craftsman_id"),
    jobs: await all("jobs", "craftsman_id"),
    job_materials: await all("job_materials", "craftsman_id"),
    clients: await all("craftsman_clients", "craftsman_id"),
    client_notes: await all("client_notes", "craftsman_id"),
    client_photos: await all("client_photos", "craftsman_id"),
    offers: await all("offers", "craftsman_id"),
    quick_replies: await all("quick_replies", "craftsman_id"),
    reviews_written: await all("reviews", "client_id"),
    reviews_received: await all("reviews", "craftsman_id"),
    saved_craftsmen: await all("saved_craftsmen", "client_id"),
    bookings_as_client: await all("bookings", "client_id"),
    bookings_as_craftsman: await all("bookings", "craftsman_id"),
    conversations,
    messages,
    notifications: await all("notifications", "user_id"),
    notification_prefs: await all("notification_prefs", "user_id"),
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="moite-danni.json"',
      "Cache-Control": "no-store",
    },
  });
}
