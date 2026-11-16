import type { Metadata } from "next";
import { requireCraftsman } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { CalendarEditor, type Visit } from "./calendar-editor";

export const metadata: Metadata = { title: "Календар", robots: { index: false } };

export default async function CalendarPage() {
  const viewer = await requireCraftsman();
  const supabase = await createClient();
  const today = todayISO();
  const [{ data: rules }, { data: exceptions }, { data: days }, { data: cp }, { data: now }, { data: bookings }, { data: jobs }] =
    await Promise.all([
      supabase.from("availability_rules").select("id, weekday, start_time, end_time").eq("craftsman_id", viewer.id),
      supabase
        .from("availability_exceptions")
        .select("id, kind, start_date, end_date, start_time, end_time, note, created_at")
        .eq("craftsman_id", viewer.id)
        .gte("end_date", today)
        .order("start_date"),
      supabase.rpc("availability_days", { p_craftsman: viewer.id, p_from: today, p_days: 70 }),
      supabase.from("craftsman_profiles").select("short_notice, last_confirmed_at").eq("id", viewer.id).single(),
      supabase.rpc("sofia_now"),
      supabase.rpc("my_bookings", {}),
      supabase
        .from("jobs")
        .select("id, title, start_date, end_date, start_time, end_time")
        .eq("craftsman_id", viewer.id)
        .eq("status", "planned")
        .gte("end_date", today),
    ]);

  // minutes from 00:00 by the database clock: "2026-11-16T19:40:00"
  const nowMin = typeof now === "string" ? Number(now.slice(11, 13)) * 60 + Number(now.slice(14, 16)) : 0;

  const visits: Visit[] = [
    ...(bookings ?? [])
      .filter((b) => b.i_am === "craftsman" && (b.status === "confirmed" || b.status === "proposed") && (b.end_date ?? b.booking_date) >= today)
      .map(
        (b): Visit => ({
          id: b.id,
          date: b.booking_date,
          endDate: b.end_date,
          start: b.start_time,
          end: b.end_time,
          kind: b.status === "confirmed" ? "confirmed" : "proposed",
          title: b.kind === "inspection" ? "Оглед" : "Работа",
          who: b.partner_name,
          href: `/saobshtenia/${b.conversation_id}`,
        }),
      ),
    ...(jobs ?? []).map(
      (j): Visit => ({
        id: `job-${j.id}`,
        date: j.start_date,
        endDate: j.end_date !== j.start_date ? j.end_date : null,
        start: j.start_time,
        end: j.end_time,
        kind: "job",
        title: j.title,
        who: "записана от теб",
        href: "/tabla/porachki",
      }),
    ),
  ];

  return (
    <CalendarEditor
      userId={viewer.id}
      initialRules={rules ?? []}
      initialExceptions={exceptions ?? []}
      initialDays={(days ?? []) as never}
      shortNotice={cp?.short_notice ?? false}
      lastConfirmedAt={cp?.last_confirmed_at ?? new Date().toISOString()}
      visits={visits}
      nowMin={nowMin}
    />
  );
}
