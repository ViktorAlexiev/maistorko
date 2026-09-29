import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";
import { UserActions } from "./user-actions";

const ROLES = [
  ["", "Всички"],
  ["craftsman", "Майстори"],
  ["client", "Клиенти"],
  ["admin", "Админи"],
] as const;
const ROLE_LABEL = { client: "клиент", craftsman: "майстор", admin: "админ" } as const;
const PAGE = 30;

export default async function AdminUsersPage({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const role = typeof sp.rolya === "string" && ["client", "craftsman", "admin"].includes(sp.rolya) ? sp.rolya : "";
  const page = Math.max(1, Number(sp.str) || 1);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_q: q || undefined,
    p_role: (role || undefined) as "client" | "craftsman" | "admin" | undefined,
    p_limit: PAGE,
    p_offset: (page - 1) * PAGE,
  });
  const total = Number(data?.[0]?.total_count ?? 0);
  const qs = (patch: Record<string, string | number>) => {
    const p = new URLSearchParams();
    const merged = { q, rolya: role, str: page, ...patch };
    Object.entries(merged).forEach(([k, v]) => v && v !== 1 && p.set(k, String(v)));
    return `/admin${p.size ? `?${p}` : ""}`;
  };

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Потребители</h1>
        <p className="mt-2 text-ink-2">Блокиране на акаунти, скриване на профили и значка „Проверен“ за майстори.</p>
      </div>

      <form className="flex flex-wrap items-end gap-2" action="/admin">
        <div className="min-w-60 flex-1">
          <label htmlFor="q" className="label">
            Търсене
          </label>
          <input id="q" name="q" className="field" defaultValue={q} placeholder="име или имейл" />
        </div>
        {role && <input type="hidden" name="rolya" value={role} />}
        <button type="submit" className="btn btn-primary">
          Търси
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        {ROLES.map(([value, label]) => (
          <Link key={value} href={qs({ rolya: value, str: 1 })} className="chip" aria-pressed={role === value}>
            {label}
          </Link>
        ))}
      </div>

      {error ? (
        <p role="alert" className="rounded-[8px] bg-danger-soft px-4 py-3 text-danger">
          {error.message}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
          <table className="w-full min-w-[46rem] text-left text-[0.95rem]">
            <caption className="sr-only">Потребители</caption>
            <thead className="border-b border-ink text-sm">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Потребител
                </th>
                <th scope="col" className="px-4 py-3">
                  Роля
                </th>
                <th scope="col" className="px-4 py-3">
                  Регистриран
                </th>
                <th scope="col" className="px-4 py-3">
                  Статус
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-bold">
                      {u.craftsman_slug ? (
                        <Link href={`/maistori/${u.craftsman_slug}`} className="hover:underline">
                          {u.full_name || "(без име)"}
                        </Link>
                      ) : (
                        u.full_name || "(без име)"
                      )}
                    </p>
                    <p className="text-sm text-ink-3">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                  <td className="px-4 py-3 text-ink-2">{timeAgo(u.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.is_banned && <span className="rounded bg-danger-soft px-1.5 py-0.5 text-xs font-bold text-danger">блокиран</span>}
                      {u.is_hidden && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-bold">скрит</span>}
                      {u.is_verified && <span className="rounded bg-free-soft px-1.5 py-0.5 text-xs font-bold text-free">проверен</span>}
                      {!u.is_banned && !u.is_hidden && !u.is_verified && <span className="text-sm text-ink-3">активен</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <UserActions
                      id={u.id}
                      isAdmin={u.role === "admin"}
                      isCraftsman={Boolean(u.craftsman_slug)}
                      banned={u.is_banned}
                      verified={Boolean(u.is_verified)}
                      hidden={Boolean(u.is_hidden)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!data?.length && <p className="p-6 text-ink-2">Няма потребители по тези критерии.</p>}
        </div>
      )}
      {total > PAGE && (
        <nav aria-label="Страници" className="flex items-center gap-2">
          {page > 1 && (
            <Link href={qs({ str: page - 1 })} className="btn btn-outline btn-sm">
              Предишна
            </Link>
          )}
          <span className="text-sm text-ink-2">
            Страница {page} от {Math.ceil(total / PAGE)}
          </span>
          {page * PAGE < total && (
            <Link href={qs({ str: page + 1 })} className="btn btn-outline btn-sm">
              Следваща
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
