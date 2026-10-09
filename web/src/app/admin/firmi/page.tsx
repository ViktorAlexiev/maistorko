import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCities } from "@/lib/data";
import { OrgAdmin, CreateOrgForm } from "./org-admin";

export const metadata = { title: "Фирми" };

export default async function AdminOrgsPage() {
  const supabase = await createClient();
  const [cities, { data: orgs }, { data: members }] = await Promise.all([
    getCities(),
    supabase
      .from("organizations")
      .select("id, slug, name, eik, is_verified, is_hidden, plan_status, plan_valid_until, city_id, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("organization_members").select("organization_id, role"),
  ]);
  const count = (id: string, role?: string) => (members ?? []).filter((m) => m.organization_id === id && (!role || m.role === role)).length;

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Фирми</h1>
        <p className="mt-2 max-w-2xl text-ink-2">
          Създаваш фирма след договорка (запитванията са в{" "}
          <Link href="/admin/zapitvaniya" className="link font-semibold">
            Запитвания
          </Link>
          ). Получаваш линк за собственика; той добавя майсторите си сам.
        </p>
      </div>

      <section aria-labelledby="new-org" className="rounded-[10px] border border-line bg-surface p-5">
        <h2 id="new-org" className="text-xl font-extrabold">
          Нова фирма
        </h2>
        <CreateOrgForm cities={cities.map((c) => ({ slug: c.slug, name: c.name }))} />
      </section>

      {!orgs?.length && <p className="rounded-[10px] border border-dashed border-line-strong p-6 text-ink-2">Още няма фирми.</p>}
      <ul className="grid gap-4">
        {(orgs ?? []).map((o) => (
          <li key={o.id} className="rounded-[10px] border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-lg font-extrabold">
                <Link href={`/firmi/${o.slug}`} className="hover:underline">
                  {o.name}
                </Link>
              </p>
              {o.eik && <span className="text-sm text-ink-3">ЕИК {o.eik}</span>}
              {o.is_verified && <span className="rounded bg-free-soft px-1.5 py-0.5 text-xs font-bold text-free">проверена</span>}
              {o.is_hidden && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-bold">скрита</span>}
              {o.plan_status === "paused" && <span className="rounded bg-danger-soft px-1.5 py-0.5 text-xs font-bold text-danger">планът е спрян</span>}
              <span className="ml-auto text-sm text-ink-2">
                {count(o.id, "owner")} собственик · {count(o.id, "manager")} мениджъри · {count(o.id, "craftsman")} майстори
              </span>
            </div>
            <OrgAdmin
              id={o.id}
              verified={o.is_verified}
              hidden={o.is_hidden}
              planStatus={o.plan_status as "active" | "paused"}
              hasOwner={count(o.id, "owner") > 0}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
