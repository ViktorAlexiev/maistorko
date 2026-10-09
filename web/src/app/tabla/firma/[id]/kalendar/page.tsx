import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { CalendarEditor } from "@/app/tabla/kalendar/calendar-editor";

export const metadata: Metadata = { title: "Календар на майстор", robots: { index: false } };

export default async function EmployeeCalendarPage({ params }: PageProps<"/tabla/firma/[id]/kalendar">) {
  const { id } = await params;
  const supabase = await createClient();
  const today = todayISO();
  const [{ data: rules }, { data: exceptions }, { data: days }, { data: cp }] = await Promise.all([
    supabase.from("availability_rules").select("id, weekday, start_time, end_time").eq("craftsman_id", id),
    supabase
      .from("availability_exceptions")
      .select("id, kind, start_date, end_date, start_time, end_time, note, created_at")
      .eq("craftsman_id", id)
      .gte("end_date", today)
      .order("start_date"),
    supabase.rpc("availability_days", { p_craftsman: id, p_from: today, p_days: 70 }),
    supabase.from("craftsman_profiles").select("short_notice, last_confirmed_at").eq("id", id).single(),
  ]);

  return (
    <CalendarEditor
      userId={id}
      managing
      initialRules={rules ?? []}
      initialExceptions={exceptions ?? []}
      initialDays={(days ?? []) as never}
      shortNotice={cp?.short_notice ?? false}
      lastConfirmedAt={cp?.last_confirmed_at ?? new Date().toISOString()}
    />
  );
}
