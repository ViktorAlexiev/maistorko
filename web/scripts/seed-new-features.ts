/**
 * Local demo data for the newest features (offers, client notebook, quick replies), for the main demo craftsman
 * (maistor@maistorko.test, Pro). Safe to run again: it replaces what it created before.
 * LOCAL ONLY (service role key from .env.local).
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Липсват NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY в .env.local");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const day = (offset: number) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10);

async function must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>, what: string) {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function main() {
  const { data: users } = await db.auth.admin.listUsers({ perPage: 200 });
  const me = users.users.find((u) => u.email === "maistor@maistorko.test")?.id;
  if (!me) throw new Error("Няма maistor@maistorko.test. Пусни първо `npm run seed`.");

  // start clean (only what this script owns)
  await db.from("offers").delete().eq("craftsman_id", me);
  await db.from("quick_replies").delete().eq("craftsman_id", me);
  await db.from("craftsman_clients").delete().eq("craftsman_id", me).like("note", "[демо]%");

  const base = { yearly_check: false, remind_at: null as string | null, remind_note: null as string | null };
  const clients = await must(
    db
      .from("craftsman_clients")
      .insert([
        { ...base, craftsman_id: me, name: "Мария Петрова", phone: "0899 000 201", address: "ул. Роза 12, ет. 3", note: "[демо] Стара инсталация", status: "new", remind_at: day(-1), remind_note: "Да се обадя за огледа" },
        { ...base, craftsman_id: me, name: "Георги Колев", phone: "0899 000 202", address: "ж.к. Младост 1", note: "[демо] Домофон 14", status: "offer", remind_at: day(2), remind_note: "Попитай за офертата" },
        { ...base, craftsman_id: me, name: "Анна Стоянова", phone: "0899 000 203", address: "кв. Лозенец", note: "[демо] Идва след 18 ч", status: "agreed", yearly_check: true },
        { ...base, craftsman_id: me, name: "Николай Иванов", phone: "0899 000 204", address: "гр. Пловдив, Кършияка", note: "[демо] Бойлер 80 л", status: "done", yearly_check: true },
      ])
      .select("id, name"),
    "clients",
  );
  const byName = Object.fromEntries((clients ?? []).map((c) => [c.name, c.id]));

  await must(
    db.from("client_notes").insert([
      { client_id: byName["Мария Петрова"], craftsman_id: me, body: "Контактът в банята искри. Да взема нов контакт и ключ." },
      { client_id: byName["Георги Колев"], craftsman_id: me, body: "Иска предложение за таблото. Да прати снимка." },
    ]),
    "notes",
  );
  await must(
    db.from("jobs").insert({
      craftsman_id: me,
      client_id: byName["Николай Иванов"],
      title: "Смяна на бойлер",
      source: "recommendation",
      start_date: day(-20),
      end_date: day(-20),
      status: "done",
      labor_price: 60,
      transport_price: 10,
    }),
    "job",
  );

  const lines = [
    { name: "Монтаж на нов контакт и ключ", amount: "35.00", kind: "service" },
    { name: "Контакт и ключ", amount: "9.50", kind: "material" },
  ];
  await must(
    db.from("offers").insert([
      { craftsman_id: me, title: "Смяна на контакти в банята", client_name: "Мария Петрова", lines, note: null, start_date: day(4), end_date: day(4) },
      { craftsman_id: me, title: "Преместване на ел. табло", client_name: "Георги Колев", lines: [{ name: "Преместване и свързване на табло", amount: "180.00", kind: "service" }], note: "Гаранция 12 месеца.", start_date: null, end_date: null },
    ]),
    "offers",
  );
  await must(db.from("quick_replies").insert([{ craftsman_id: me, body: "Идвам след 18 ч, удобно ли е?" }, { craftsman_id: me, body: "Цената включва материалите." }]), "quick replies");

  // a short "busy" example is left out on purpose: the "Заето до …" button on the dashboard is for trying it live
  const offers = await must(db.from("offers").select("token, title"), "offers read");
  console.log("✓ Демо данни за новите функции са готови.");
  for (const o of offers ?? []) console.log(`  оферта „${o.title}“: /oferta/${o.token}`);
}

main().catch((e) => {
  console.error("✗", e.message);
  process.exit(1);
});
