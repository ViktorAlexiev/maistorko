import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Дневник" };

const ACTION: Record<string, string> = {
  ban: "блокира потребител",
  unban: "отблокира потребител",
  verify: "маркира като проверен",
  unverify: "махна „Проверен“",
  hide: "скри профил",
  unhide: "показа профил",
  set_plan: "промени план",
  contact_status: "промени статус на запитване",
  reports_done: "приключи доклади",
  reports_dismissed: "отхвърли доклади",
};

export default async function AdminLogPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_log")
    .select("id, admin_id, action, target_type, target_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(150);
  const adminIds = [...new Set((data ?? []).map((l) => l.admin_id).filter(Boolean))] as string[];
  const { data: admins } = adminIds.length ? await supabase.from("profiles").select("id, full_name").in("id", adminIds) : { data: [] };
  const name = (id: string | null) => (admins ?? []).find((a) => a.id === id)?.full_name || "админ";

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Дневник</h1>
        <p className="mt-2 text-ink-2">Кой администратор какво е направил. Последните 150 действия.</p>
      </div>
      {error && (
        <p role="alert" className="rounded-[8px] bg-danger-soft px-4 py-3 text-danger">
          {error.message}
        </p>
      )}
      <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
        <table className="w-full min-w-[40rem] text-left text-[0.95rem]">
          <caption className="sr-only">Действия на администраторите</caption>
          <thead className="border-b border-ink text-sm">
            <tr>
              <th scope="col" className="px-4 py-3">Кога</th>
              <th scope="col" className="px-4 py-3">Кой</th>
              <th scope="col" className="px-4 py-3">Какво</th>
              <th scope="col" className="px-4 py-3">За</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((l) => (
              <tr key={l.id} className="border-b border-line last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 text-ink-2">{formatDateTime(l.created_at)}</td>
                <td className="px-4 py-2.5">{name(l.admin_id)}</td>
                <td className="px-4 py-2.5 font-semibold">
                  {ACTION[l.action] ?? l.action}
                  {l.details && Object.keys(l.details as object).length > 0 && (
                    <span className="ml-2 font-normal text-ink-3">{JSON.stringify(l.details)}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-ink-3">
                  {l.target_type} {l.target_id?.slice(0, 8)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.length && <p className="p-6 text-ink-2">Още няма записани действия.</p>}
      </div>
    </div>
  );
}
