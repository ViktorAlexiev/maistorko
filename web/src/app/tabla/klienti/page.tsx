import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { requireCraftsman } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyPlan, hasFeature } from "@/lib/plan";
import { todayISO } from "@/lib/format";
import { ClientNotebook, type NotebookClient, type NotebookNote } from "./client-notebook";

export const metadata: Metadata = { title: "Клиенти", robots: { index: false } };

export default async function ClientsPage() {
  const viewer = await requireCraftsman();
  const plan = await getMyPlan();
  const pro = hasFeature(plan, "client_cards");
  const supabase = await createClient();

  const [{ data: clients }, { data: notes }, { data: jobs }] = pro
    ? await Promise.all([
        supabase
          .from("craftsman_clients")
          .select("id, name, phone, address, status, remind_at, remind_note, yearly_check")
          .eq("craftsman_id", viewer.id)
          .order("name")
          .limit(500),
        supabase
          .from("client_notes")
          .select("id, client_id, body, created_at")
          .eq("craftsman_id", viewer.id)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("jobs")
          .select("client_id, title, end_date, status")
          .eq("craftsman_id", viewer.id)
          .not("client_id", "is", null)
          .order("end_date", { ascending: false })
          .limit(1000),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const lastJob = new Map<string, { title: string; end_date: string; count: number }>();
  for (const j of jobs ?? []) {
    if (!j.client_id || j.status === "cancelled") continue;
    const prev = lastJob.get(j.client_id);
    lastJob.set(j.client_id, prev ? { ...prev, count: prev.count + 1 } : { title: j.title, end_date: j.end_date, count: 1 });
  }

  return (
    <div className="grid max-w-4xl gap-8">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Клиенти</h1>
        <p className="mt-2 max-w-2xl text-lg text-ink-2">
          Тетрадката ти с клиенти: на какъв етап е всеки, кога да му се обадиш и какво сте си казали. Клиентите се добавят и от „Поръчки“.
        </p>
      </div>

      {pro ? (
        <ClientNotebook
          today={todayISO()}
          userId={viewer.id}
          initialClients={(clients ?? []) as NotebookClient[]}
          initialNotes={(notes ?? []) as NotebookNote[]}
          lastJob={Object.fromEntries(lastJob)}
        />
      ) : (
        <div className="flex items-start gap-3 rounded-[10px] border border-dashed border-line-strong p-5">
          <Lock className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-ink-2">
            Тетрадката с клиенти (етапи, напомняния за обаждане и бележки) е в Pro.{" "}
            <Link href="/tabla/plan" className="link font-bold">
              Виж плановете
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
