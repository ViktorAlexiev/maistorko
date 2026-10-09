import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { ReportActions } from "./report-actions";

export const metadata = { title: "Доклади" };

const REASON = { spam: "Спам", scam: "Измама", offensive: "Обидно поведение", fake: "Фалшив профил", other: "Друго" } as const;
const TYPE = { profile: "профил", conversation: "разговор", review: "отзив" } as const;

type Report = {
  id: string;
  reporter_id: string | null;
  target_type: keyof typeof TYPE;
  target_user: string | null;
  reason: keyof typeof REASON;
  details: string | null;
  created_at: string;
};

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select("id, reporter_id, target_type, target_user, reason, details, created_at")
    .eq("status", "new")
    .order("created_at", { ascending: false })
    .limit(200);
  const reports = (data ?? []) as Report[];

  // group by the person reported, the one with the most different reporters first
  const groups = new Map<string, Report[]>();
  for (const r of reports) if (r.target_user) groups.set(r.target_user, [...(groups.get(r.target_user) ?? []), r]);
  const ids = [...groups.keys()];
  const [{ data: people }, { data: crafts }] = ids.length
    ? await Promise.all([
        supabase.from("profiles").select("id, full_name, is_banned").in("id", ids),
        supabase.from("craftsman_profiles").select("id, slug, display_name, is_hidden").in("id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const person = (id: string) => (people ?? []).find((p) => p.id === id);
  const craft = (id: string) => (crafts ?? []).find((c) => c.id === id);
  const sorted = [...groups.entries()].sort(
    (a, b) => new Set(b[1].map((r) => r.reporter_id)).size - new Set(a[1].map((r) => r.reporter_id)).size || b[1].length - a[1].length,
  );

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Доклади</h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          Групирани по човека, за когото са. Колкото повече различни хора докладват, толкова по-нагоре е. Нищо не се скрива автоматично: решаваш ти.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-[8px] bg-danger-soft px-4 py-3 text-danger">
          {error.message}
        </p>
      )}
      {!error && sorted.length === 0 && <p className="rounded-[10px] border border-dashed border-line-strong p-6 text-ink-2">Няма нови доклади.</p>}
      <ul className="grid gap-4">
        {sorted.map(([userId, list]) => {
          const p = person(userId);
          const c = craft(userId);
          const reporters = new Set(list.filter((r) => r.reporter_id).map((r) => r.reporter_id)).size;
          const auto = list.filter((r) => !r.reporter_id).length;
          return (
            <li key={userId} className="rounded-[10px] border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-lg font-extrabold">
                  {c ? (
                    <Link href={`/maistori/${c.slug}`} className="hover:underline">
                      {c.display_name}
                    </Link>
                  ) : (
                    p?.full_name || "(без име)"
                  )}
                </p>
                <span className="rounded bg-rule px-1.5 py-0.5 text-xs font-bold">
                  {list.length} {list.length === 1 ? "доклад" : "доклада"}
                </span>
                {reporters > 0 && <span className="text-sm text-ink-2">от {reporters} {reporters === 1 ? "човек" : "души"}</span>}
                {auto > 0 && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-bold">автоматично засечено</span>}
                {p?.is_banned && <span className="rounded bg-danger-soft px-1.5 py-0.5 text-xs font-bold text-danger">блокиран</span>}
                {c?.is_hidden && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-bold">скрит</span>}
              </div>
              <ul className="mt-3 grid gap-2 border-t border-line pt-3">
                {list.map((r) => (
                  <li key={r.id} className="text-sm">
                    <span className="font-bold">{REASON[r.reason]}</span>
                    <span className="text-ink-3"> · {TYPE[r.target_type]} · {timeAgo(r.created_at)}</span>
                    {r.details && <p className="mt-0.5 whitespace-pre-line text-ink-2">{r.details}</p>}
                  </li>
                ))}
              </ul>
              <ReportActions userId={userId} isCraftsman={Boolean(c)} hidden={Boolean(c?.is_hidden)} banned={Boolean(p?.is_banned)} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
