import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { RequestActions } from "./request-actions";

const KIND = { company: "Фирма", pro: "Pro", other: "Друго" } as const;
const STATUSES = ["new", "talking", "done", "rejected"] as const;
const STATUS_LABEL = { new: "Ново", talking: "В разговор", done: "Приключено", rejected: "Отказано" } as const;

export default async function RequestsPage({ searchParams }: PageProps<"/admin/zapitvaniya">) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" && (STATUSES as readonly string[]).includes(sp.status) ? sp.status : "";
  const supabase = await createClient();
  let q = supabase
    .from("contact_requests")
    .select("id, kind, name, contact, message, payload, status, admin_note, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Запитвания</h1>
        <p className="mt-2 text-ink-2">Фирми, които искат да се свържат, и майстори, които искат Pro.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {[["", "Всички"], ...STATUSES.map((s) => [s, STATUS_LABEL[s]])].map(([value, label]) => (
          <Link key={value} href={value ? `/admin/zapitvaniya?status=${value}` : "/admin/zapitvaniya"} className="chip" aria-pressed={status === value}>
            {label}
          </Link>
        ))}
      </div>
      {error && (
        <p role="alert" className="rounded-[8px] bg-danger-soft px-4 py-3 text-danger">
          {error.message}
        </p>
      )}
      {!error && !data?.length && <p className="rounded-[10px] border border-dashed border-line-strong p-6 text-ink-2">Няма запитвания.</p>}
      <ul className="grid gap-3">
        {(data ?? []).map((r) => (
          <li key={r.id} className="rounded-[10px] border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="rounded bg-rule px-1.5 py-0.5 text-xs font-bold">{KIND[r.kind as keyof typeof KIND]}</span>
              <p className="font-extrabold">{r.name}</p>
              <p className="font-semibold">{r.contact}</p>
              <p className="ml-auto text-sm text-ink-3">{timeAgo(r.created_at)}</p>
            </div>
            {r.message && <p className="mt-2 whitespace-pre-line text-ink-2">{r.message}</p>}
            {r.payload && Object.keys(r.payload as object).length > 0 && (
              <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                {Object.entries(r.payload as Record<string, string>).map(([k, v]) => (
                  <div key={k} className="flex gap-1.5">
                    <dt className="text-ink-3">{k}:</dt>
                    <dd className="font-semibold">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
            <RequestActions id={r.id} status={r.status as (typeof STATUSES)[number]} note={r.admin_note ?? ""} />
          </li>
        ))}
      </ul>
    </div>
  );
}
