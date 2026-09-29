import type { Metadata } from "next";
import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CraftsmanRow, type CraftsmanCardData } from "@/components/craftsman-row";
import { EmptyState } from "@/components/bits";
import { RuleLegend } from "@/components/rule-strip";

export const metadata: Metadata = { title: "Запазени майстори", robots: { index: false } };

export default async function SavedPage() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: saved } = await supabase.from("saved_craftsmen").select("craftsman_id").eq("client_id", viewer.id);
  const ids = (saved ?? []).map((s) => s.craftsman_id);
  const { data } = ids.length
    ? await supabase.rpc("search_craftsmen", { p_ids: ids, p_limit: 48, p_sort: "soonest" })
    : { data: [] };
  const rows = (data ?? []) as CraftsmanCardData[];

  return (
    <div className="grid gap-6">
      <h1 className="display text-5xl sm:text-6xl">Запазени майстори</h1>
      {rows.length ? (
        <>
          <RuleLegend />
          <ul className="grid gap-3">
            {rows.map((c) => (
              <li key={c.id}>
                <CraftsmanRow c={c} />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <EmptyState
          title="Няма запазени майстори"
          action={
            <Link href="/maistori" className="btn btn-primary">
              Разгледай майсторите
            </Link>
          }
        >
          Натиснете „Запази“ на профила на майстор, за да го намерите лесно после.
        </EmptyState>
      )}
    </div>
  );
}
