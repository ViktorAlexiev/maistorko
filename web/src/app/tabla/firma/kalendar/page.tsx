import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyOrg, isManager } from "@/lib/org";
import { todayISO, relativeDay } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { RuleLegend, RuleStrip } from "@/components/rule-strip";

export const metadata: Metadata = { title: "Календар на екипа", robots: { index: false } };

export default async function TeamCalendarPage() {
  const viewer = await requireViewer("/tabla/firma/kalendar");
  const org = await getMyOrg();
  if (!org || !isManager(org)) redirect("/tabla/firma");
  const supabase = await createClient();
  const today = todayISO();
  const { data: team } = await supabase.rpc("org_team");
  const craftsmen = (team ?? []).filter((m) => m.slug);
  const strips = await Promise.all(
    craftsmen.map(async (m) => {
      const { data } = await supabase.rpc("availability_strip", { p_craftsman: m.user_id, p_from: today, p_days: 14 });
      return [m.user_id, data as string | null] as const;
    }),
  );
  const strip = new Map(strips);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Календар на екипа</h1>
        <p className="mt-2 max-w-2xl text-lg text-ink-2">
          Кой е свободен през следващите две седмици. Натисни майстор, за да му промениш календара или да му запишеш поръчка.
        </p>
      </div>
      <RuleLegend />
      {craftsmen.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-line-strong p-6 text-ink-2">Още няма майстори във фирмата.</p>
      ) : (
        <ul className="grid gap-3">
          {craftsmen.map((m) => {
            const own = m.user_id === viewer.id;
            const base = own ? "/tabla" : `/tabla/firma/${m.user_id}`;
            return (
              <li key={m.user_id} className="grid gap-3 rounded-[10px] border border-line bg-surface p-4 lg:grid-cols-[14rem_minmax(0,1fr)_auto] lg:items-center">
                <div className="flex items-center gap-3">
                  <Avatar name={m.name} url={m.avatar_url} size={44} />
                  <div className="min-w-0">
                    <p className="truncate font-extrabold">{m.name}</p>
                    <p className="text-sm text-ink-2">{m.next_free ? `свободен ${relativeDay(m.next_free)}` : "няма свободни дни скоро"}</p>
                  </div>
                </div>
                <div className="min-w-0 overflow-x-auto">
                  {strip.get(m.user_id) ? (
                    <RuleStrip strip={strip.get(m.user_id)!} size="sm" className="min-w-[26rem]" />
                  ) : (
                    <p className="text-sm text-ink-3">Календарът още не е настроен.</p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Link href={`${base}/kalendar`} className="btn btn-outline btn-sm">
                    Календар
                  </Link>
                  <Link href={`${base}/porachki`} className="btn btn-outline btn-sm">
                    Поръчки
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
