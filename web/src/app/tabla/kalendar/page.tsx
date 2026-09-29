import type { Metadata } from "next";
import { requireCraftsman } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { CalendarEditor } from "./calendar-editor";
import { UpcomingBookings } from "@/components/upcoming-bookings";

export const metadata: Metadata = { title: "Календар", robots: { index: false } };

export default async function CalendarPage() {
  const viewer = await requireCraftsman();
  const supabase = await createClient();
  const today = todayISO();
  const [{ data: rules }, { data: exceptions }, { data: days }, { data: cp }] = await Promise.all([
    supabase.from("availability_rules").select("id, weekday, start_time, end_time").eq("craftsman_id", viewer.id),
    supabase
      .from("availability_exceptions")
      .select("id, kind, start_date, end_date, start_time, end_time, note, created_at")
      .eq("craftsman_id", viewer.id)
      .gte("end_date", today)
      .order("start_date"),
    supabase.rpc("availability_days", { p_craftsman: viewer.id, p_from: today, p_days: 70 }),
    supabase.from("craftsman_profiles").select("short_notice, last_confirmed_at").eq("id", viewer.id).single(),
  ]);

  return (
    <div className="grid gap-12">
    <CalendarEditor
      userId={viewer.id}
      initialRules={rules ?? []}
      initialExceptions={exceptions ?? []}
      initialDays={(days ?? []) as never}
      shortNotice={cp?.short_notice ?? false}
      lastConfirmedAt={cp?.last_confirmed_at ?? new Date().toISOString()}
    />
      <UpcomingBookings title="Уговорени посещения" limit={20} />
    </div>
  );
}
