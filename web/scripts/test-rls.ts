/**
 * Row Level Security tests against the local Supabase.
 * Uses the service role only to create/clean up throwaway fixture users; every
 * assertion runs through the public anon key as anon or as a signed-in user.
 *
 *   npm run test:rls
 */
import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!/127\.0\.0\.1|localhost/.test(URL)) {
  console.error("RLS тестовете се пускат само срещу локален Supabase.");
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const PASS = "test-rls-12345";
const TAG = `rls${Date.now()}`;
let passed = 0;
let failed = 0;

function ok(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`, detail ?? "");
  }
}

async function user(role: "client" | "craftsman", name: string) {
  const email = `${TAG}-${name}@maistorko.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASS,
    email_confirm: true,
    user_metadata: { full_name: `Тест ${name}`, role, city: "sofia" },
  });
  if (error) throw error;
  const c = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const s = await c.auth.signInWithPassword({ email, password: PASS });
  if (s.error) throw s.error;
  return { id: data.user!.id, c };
}

const addIso = (day: string, n: number) => new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10);

async function main() {
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  console.log("→ Подготовка на тестови потребители…");
  const alice = await user("client", "alice");
  const bob = await user("client", "bob");
  const craft = await user("craftsman", "craft");
  const other = await user("craftsman", "other");

  // fixtures: craft gets a category so he is listed; alice <-> craft conversation with a reply
  const { data: cat } = await admin.from("categories").select("id").eq("slug", "el-instalatsii").single();
  await admin.from("craftsman_categories").insert([
    { craftsman_id: craft.id, category_id: cat!.id },
    { craftsman_id: other.id, category_id: cat!.id },
  ]);
  const { data: convId, error: convErr } = await alice.c.rpc("start_conversation", { p_craftsman: craft.id, p_body: "Здравейте, тест" });
  ok("клиент може да започне разговор", !convErr && Boolean(convId), convErr);
  const { error: replyErr } = await craft.c.from("messages").insert({ conversation_id: convId, sender_id: craft.id, body: "Отговор" });
  ok("майсторът може да отговори в своя разговор", !replyErr, replyErr);

  console.log("\nАнонимен посетител");
  {
    const { data } = await anon.from("profiles").select("id, phone");
    ok("не вижда таблицата profiles (лични данни)", !data || data.length === 0, data?.length);
    const { data: conv } = await anon.from("conversations").select("id");
    ok("не вижда разговори", !conv || conv.length === 0);
    const { data: msgs } = await anon.from("messages").select("id");
    ok("не вижда съобщения", !msgs || msgs.length === 0);
    const { data: pub, error } = await anon.from("craftsman_profiles").select("id, slug").eq("id", craft.id);
    ok("вижда публичен профил на майстор", !error && pub?.length === 1, error);
    const { data: search, error: se } = await anon.rpc("search_craftsmen", { p_limit: 5 });
    ok("може да търси майстори", !se && Array.isArray(search) && search.length > 0, se);
    const { error: ins } = await anon.from("services").insert({ craftsman_id: craft.id, name: "Хак", price_kind: "quote" });
    ok("не може да добавя услуги", Boolean(ins));
    const { error: rpcErr } = await anon.rpc("admin_list_users", {});
    ok("не може да вика admin_list_users", Boolean(rpcErr));
  }

  console.log("\nКлиент");
  {
    const { data: others } = await alice.c.from("profiles").select("id");
    ok("вижда само собствения си profiles ред", others?.length === 1 && others[0].id === alice.id, others);
    const { error: roleErr } = await alice.c.from("profiles").update({ role: "admin" }).eq("id", alice.id);
    ok("не може да си смени ролята на admin", Boolean(roleErr), roleErr);
    const { data: upd } = await alice.c.from("profiles").update({ full_name: "Хакната" }).eq("id", bob.id).select("id");
    ok("не може да редактира чужд профил", !upd || upd.length === 0);
    const { data: bobConv } = await bob.c.from("conversations").select("id").eq("id", convId as string);
    ok("друг клиент не вижда чужд разговор", !bobConv || bobConv.length === 0);
    const { data: bobMsgs } = await bob.c.from("messages").select("id").eq("conversation_id", convId as string);
    ok("друг клиент не вижда чужди съобщения", !bobMsgs || bobMsgs.length === 0);
    const { error: inject } = await bob.c.from("messages").insert({ conversation_id: convId, sender_id: bob.id, body: "инжекция" });
    ok("друг клиент не може да пише в чужд разговор", Boolean(inject));
    const { error: spoof } = await alice.c.from("messages").insert({ conversation_id: convId, sender_id: craft.id, body: "от името на майстора" });
    ok("не може да праща съобщение от чуждо име", Boolean(spoof));
    const { error: convIns } = await bob.c.from("conversations").insert({ client_id: alice.id, craftsman_id: craft.id });
    ok("не може директно да създаде разговор", Boolean(convIns));
    const { data: cpUpd } = await alice.c.from("craftsman_profiles").update({ bio: "хак" }).eq("id", craft.id).select("id");
    ok("не може да редактира профил на майстор", !cpUpd || cpUpd.length === 0);
    const { error: rulesErr } = await alice.c.from("availability_rules").insert({ craftsman_id: craft.id, weekday: 1, start_time: "08:00", end_time: "12:00" });
    ok("не може да пише в календара на майстор", Boolean(rulesErr));
  }

  console.log("\nОтзиви");
  {
    const { error: good } = await alice.c.from("reviews").insert({ craftsman_id: craft.id, client_id: alice.id, rating: 5, body: "Тест" });
    ok("клиент с разговор (и отговор) може да остави отзив", !good, good);
    const { error: noConv } = await bob.c.from("reviews").insert({ craftsman_id: craft.id, client_id: bob.id, rating: 1, body: "фалшив" });
    ok("клиент без разговор не може да остави отзив", Boolean(noConv));
    const { error: asOther } = await bob.c.from("reviews").insert({ craftsman_id: other.id, client_id: alice.id, rating: 1 });
    ok("не може да пише отзив от чуждо име", Boolean(asOther));
    const { data: cp } = await admin.from("craftsman_profiles").select("rating_avg, rating_count").eq("id", craft.id).single();
    ok("рейтингът се преизчислява с тригер", Number(cp?.rating_avg) === 5 && cp?.rating_count === 1, cp);
    const { error: hide } = await alice.c.from("reviews").update({ is_hidden: true }).eq("client_id", alice.id);
    ok("авторът не може сам да скрие/модерира отзив", Boolean(hide));
  }

  console.log("\nМайстор");
  {
    const { error: ver } = await craft.c.from("craftsman_profiles").update({ is_verified: true }).eq("id", craft.id);
    ok("не може сам да си сложи „Проверен“", Boolean(ver), ver);
    const { error: rating } = await craft.c.from("craftsman_profiles").update({ rating_avg: 5, rating_count: 99 }).eq("id", craft.id);
    ok("не може да си променя рейтинга", Boolean(rating));
    const { error: own } = await craft.c.from("availability_rules").insert({ craftsman_id: craft.id, weekday: 2, start_time: "08:00", end_time: "17:00" });
    ok("може да редактира собствения си календар", !own, own);
    const { error: foreign } = await craft.c.from("services").insert({ craftsman_id: other.id, name: "Чужда", price_kind: "quote" });
    ok("не може да добавя услуги на друг майстор", Boolean(foreign));
    const { data: delOther } = await craft.c.from("work_photos").delete().eq("craftsman_id", other.id).select("id");
    ok("не може да трие чужди снимки", !delOther || delOther.length === 0);
    const { data: bobSaved } = await craft.c.from("saved_craftsmen").select("client_id").eq("client_id", alice.id);
    ok("не вижда чужди запазени майстори", !bobSaved || bobSaved.length === 0);
  }

  console.log("\nУговорки");
  {
    // next Tuesday (craft has a Tuesday 08:00–17:00 rule from the section above)
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + (((2 - d.getUTCDay() + 7) % 7) || 7));
    const day = d.toISOString().slice(0, 10);
    const freeAt = async () => {
      const { data } = await anon.rpc("availability_days", { p_craftsman: craft.id, p_from: day, p_days: 1 });
      const ranges = (data?.[0]?.ranges ?? []) as { start: string; end: string }[];
      return ranges.map((r) => `${r.start}-${r.end}`).join(",");
    };
    ok("вторник е свободен 08–17 преди уговорки", (await freeAt()) === "08:00-17:00", await freeAt());

    const { data: b1, error: e1 } = await alice.c.rpc("propose_booking", {
      p_conversation: convId as string, p_date: day, p_start: "09:00", p_end: "11:00", p_kind: "inspection",
    });
    ok("клиент може да предложи уговорка в своя разговор", !e1 && Boolean(b1), e1);
    ok("предложението още не заема календара", (await freeAt()) === "08:00-17:00");
    const { data: seen } = await bob.c.from("bookings").select("id").eq("id", b1 as string);
    ok("друг потребител не вижда уговорката", !seen || seen.length === 0);
    const { data: anonSeen } = await anon.from("bookings").select("id");
    ok("анонимен не вижда уговорки", !anonSeen || anonSeen.length === 0);
    const { error: selfConfirm } = await alice.c.rpc("respond_booking", { p_booking: b1 as string, p_action: "confirm" });
    ok("клиентът не може сам да потвърди своето предложение", Boolean(selfConfirm));
    const { error: bobConfirm } = await bob.c.rpc("respond_booking", { p_booking: b1 as string, p_action: "confirm" });
    ok("чужд потребител не може да потвърди", Boolean(bobConfirm));
    const { error: directIns } = await alice.c.from("bookings").insert({
      conversation_id: convId, craftsman_id: craft.id, client_id: alice.id, booking_date: day, kind: "work", proposed_by: alice.id, status: "confirmed",
    });
    ok("уговорка не може да се вмъкне директно", Boolean(directIns));
    const { data: st, error: e2 } = await craft.c.rpc("respond_booking", { p_booking: b1 as string, p_action: "confirm" });
    ok("майсторът потвърждава", !e2 && st === "confirmed", e2);
    const after = await freeAt();
    ok("потвърденият интервал изчезва от свободните часове", after === "08:00-09:00,11:00-17:00", after);
    const { error: clash } = await craft.c.rpc("propose_booking", {
      p_conversation: convId as string, p_date: day, p_start: "10:00", p_end: "12:00", p_kind: "work",
    });
    ok("не може припокриваща се уговорка", Boolean(clash));
    const { data: b2, error: e3 } = await craft.c.rpc("propose_booking", {
      p_conversation: convId as string, p_date: day, p_start: "13:00", p_end: "16:00", p_kind: "work",
    });
    const { data: b2row } = await alice.c.from("bookings").select("status").eq("id", b2 as string).single();
    ok("уговорка от майстора чака съгласието на клиента", !e3 && b2row?.status === "proposed", e3 ?? b2row);
    const { error: e3b } = await alice.c.rpc("respond_booking", { p_booking: b2 as string, p_action: "confirm" });
    ok("клиентът се съгласява и уговорката се потвърждава", !e3b, e3b);
    const { error: e4 } = await alice.c.rpc("respond_booking", { p_booking: b1 as string, p_action: "cancel" });
    ok("клиентът може да отмени потвърдена уговорка", !e4, e4);
    ok("отменената уговорка освобождава часовете", (await freeAt()) === "08:00-13:00,16:00-17:00", await freeAt());
    const { data: bookingMsgs } = await alice.c.from("messages").select("meta").eq("conversation_id", convId as string);
    ok("всяко действие оставя съобщение в чата", (bookingMsgs ?? []).filter((m) => (m.meta as { booking_id?: string })?.booking_id).length === 5);
  }

  console.log("\nStorage");
  {
    const png = new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" });
    const { error: ownUp } = await alice.c.storage.from("avatars").upload(`${alice.id}/t.png`, png, { contentType: "image/png" });
    ok("качване в собствена папка е позволено", !ownUp, ownUp);
    const { error: foreignUp } = await alice.c.storage.from("avatars").upload(`${bob.id}/t.png`, png, { contentType: "image/png" });
    ok("качване в чужда папка е забранено", Boolean(foreignUp));
    const { error: typeErr } = await alice.c.storage
      .from("work-photos")
      .upload(`${alice.id}/x.html`, new Blob(["<script>"], { type: "text/html" }), { contentType: "text/html" });
    ok("не приема файлове, които не са снимки", Boolean(typeErr));
    await admin.storage.from("avatars").remove([`${alice.id}/t.png`]);
  }

  console.log("\nТелефон на майстора");
  {
    // make craft publicly listed and give him a phone
    await admin.from("profiles").update({ phone: "0899 111 222" }).eq("id", craft.id);
    await admin.from("craftsman_profiles").update({ quote_on_inspection: true }).eq("id", craft.id);
    await admin.from("availability_rules").insert({ craftsman_id: craft.id, weekday: 1, start_time: "08:00", end_time: "17:00" });
    const phone = async (c: typeof anon) => (await c.rpc("craftsman_phone", { p_craftsman: craft.id })).data;
    const vis = (v: string) => admin.from("craftsman_profiles").update({ phone_visibility: v }).eq("id", craft.id);

    await vis("hidden");
    ok("„на никого“: и клиент с разговор не вижда телефона", (await phone(alice.c)) === null);
    await vis("chat");
    ok("„след отговор“: клиент, на когото е отговорил, вижда телефона", (await phone(alice.c)) === "0899 111 222");
    ok("„след отговор“: клиент без разговор не го вижда", (await phone(bob.c)) === null);
    await vis("login");
    ok("„влезли“: анонимен не вижда телефона", (await phone(anon)) === null);
    ok("„влезли“: влязъл потребител го вижда", (await phone(bob.c)) === "0899 111 222");
    await vis("public");
    ok("„на всеки“: анонимен го вижда", (await phone(anon)) === "0899 111 222");
    const { data: info } = await anon.rpc("craftsman_contact_info", { p_craftsman: craft.id }).maybeSingle();
    ok("craftsman_contact_info не връща самия номер", Boolean(info) && !JSON.stringify(info).includes("0899"), info);

    const { data: svc } = await admin
      .from("services")
      .insert({ craftsman_id: other.id, name: "Чужда услуга", price_kind: "fixed", price: 10 })
      .select("id")
      .single();
    const { error: foreignSvc } = await alice.c.rpc("start_conversation", { p_craftsman: craft.id, p_body: "x", p_service: svc!.id });
    ok("не може да посочи услуга на друг майстор", Boolean(foreignSvc));
  }

  console.log("\nЛичен линк (броячи)");
  {
    const slug = (await admin.from("craftsman_profiles").select("slug").eq("id", craft.id).single()).data!.slug;
    await anon.rpc("record_link_visit", { p_slug: slug, p_source: "qr" });
    await anon.rpc("record_link_visit", { p_slug: slug, p_source: "qr" });
    await anon.rpc("record_link_visit", { p_slug: slug, p_source: "evil" });
    const { data: mine } = await craft.c.from("link_visits").select("source, visits").eq("craftsman_id", craft.id);
    ok("посещенията се броят (2 през QR, невалиден източник се игнорира)", mine?.length === 1 && mine[0].source === "qr" && mine[0].visits === 2, mine);
    const { data: others } = await other.c.from("link_visits").select("visits").eq("craftsman_id", craft.id);
    ok("друг майстор не вижда чужди посещения", !others || others.length === 0);
    const { data: anonRows, error: anonErr } = await anon.from("link_visits").select("visits");
    ok("анонимен не чете таблицата с посещения", Boolean(anonErr) || !anonRows || anonRows.length === 0);
    const { error: writeErr } = await craft.c.from("link_visits").update({ visits: 999 }).eq("craftsman_id", craft.id);
    const { data: still } = await admin.from("link_visits").select("visits").eq("craftsman_id", craft.id);
    ok("майсторът не може сам да променя броячите", Boolean(writeErr) || still?.[0]?.visits === 2, still);
  }

  console.log("\nПланове и лимити");
  {
    const boss = await user("client", "boss");
    await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);

    const svc = (n: number) => ({ craftsman_id: craft.id, name: `Услуга ${n}`, price_kind: "fixed" as const, price: 10 });
    let firstFail = 0;
    for (let n = 1; n <= 9; n++) {
      const { error } = await craft.c.from("services").insert(svc(n));
      if (error && !firstFail) firstFail = n;
    }
    ok("безплатен план: 9-та услуга е отказана", firstFail === 9, firstFail);
    const { error: limitMsg } = await craft.c.from("services").insert(svc(10));
    ok("съобщението за лимита е на български", /Безплатният план/.test(limitMsg?.message ?? ""), limitMsg?.message);

    const { error: selfPro } = await craft.c.rpc("admin_set_plan", { p_craftsman: craft.id, p_plan: "pro" });
    ok("майсторът не може сам да си даде Pro", Boolean(selfPro));
    const { error: bossPro } = await boss.c.rpc("admin_set_plan", { p_craftsman: craft.id, p_plan: "pro" });
    ok("админ може да включи Pro", !bossPro, bossPro);
    const { error: afterPro } = await craft.c.from("services").insert(svc(11));
    ok("с Pro няма лимит за услуги", !afterPro, afterPro);
    const { data: mine } = await craft.c.rpc("my_plan");
    ok("my_plan показва Pro и ползването", (mine as { plan?: string; usage?: { services: number } })?.plan === "pro" && (mine as { usage: { services: number } }).usage.services >= 9, mine);
    await boss.c.rpc("admin_set_plan", { p_craftsman: craft.id, p_plan: "free" });
    const { data: back } = await craft.c.rpc("craftsman_plan", { p_craftsman: craft.id });
    ok("връщане към безплатен план", back === "free", back);

    // contact requests: only through the function, only admins read
    const { error: directInsert } = await anon.from("contact_requests").insert({ kind: "pro", name: "Тест", contact: "0888000000" });
    ok("не може да се пише директно в contact_requests", Boolean(directInsert));
    const { data: sent, error: sendErr } = await anon.rpc("submit_contact_request", { p_kind: "company", p_name: "Фирма Тест", p_contact: "0888 000 000", p_message: "Здравейте", p_payload: { employees: "5" }, p_trap: "" });
    ok("анонимен може да изпрати запитване през функцията", !sendErr && Boolean(sent), sendErr);
    await anon.rpc("submit_contact_request", { p_kind: "other", p_name: "Бот", p_contact: "bot@example.com", p_trap: "http://spam" });
    const { data: asAdmin } = await boss.c.from("contact_requests").select("name, kind").in("name", ["Фирма Тест", "Бот"]);
    ok("админ вижда запитването, а капанът за ботове не записва нищо", asAdmin?.length === 1 && asAdmin[0].name === "Фирма Тест", asAdmin);
    const { data: asClient } = await alice.c.from("contact_requests").select("id");
    ok("обикновен потребител не вижда запитванията", !asClient || asClient.length === 0);
    await admin.from("contact_requests").delete().in("name", ["Фирма Тест", "Бот"]);
    await admin.auth.admin.deleteUser(boss.id);
  }

  console.log("\nПоръчки и работа за няколко дни");
  {
    const boss = await user("client", "boss2");
    await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400_000);
    let monday = addDays(new Date(), 1);
    while (monday.getUTCDay() !== 1) monday = addDays(monday, 1);
    // three Mondays in a row, each with the 08:00–17:00 rule from the phone test
    const m1 = iso(monday);
    const m2 = iso(addDays(monday, 7));
    const m3 = iso(addDays(monday, 14));
    const statusOf = async (day: string) => (await anon.rpc("availability_days", { p_craftsman: craft.id, p_from: day, p_days: 1 })).data?.[0]?.status;
    ok("понеделникът е свободен преди поръчката", (await statusOf(m1)) === "free", await statusOf(m1));

    const job = (patch: Record<string, unknown>) => ({ craftsman_id: craft.id, title: "Тест поръчка", start_date: m1, end_date: m1, ...patch });
    const { data: j1, error: j1e } = await craft.c.from("jobs").insert(job({})).select("id").single();
    ok("безплатен план: проста поръчка (заетост) е позволена", !j1e && Boolean(j1), j1e);
    ok("часовете на поръчката стават заети в публичния календар", (await statusOf(m1)) === "busy", await statusOf(m1));

    const { error: priced } = await craft.c.from("jobs").insert(job({ start_date: m2, end_date: m2, labor_price: 50 }));
    ok("безплатен план: цена към поръчка е в Pro", /Pro/.test(priced?.message ?? ""), priced?.message);
    const { error: clientErr } = await craft.c.from("craftsman_clients").insert({ craftsman_id: craft.id, name: "Петров" });
    ok("безплатен план: клиентска карта е в Pro", /Pro/.test(clientErr?.message ?? ""), clientErr?.message);
    const { error: rep } = await craft.c.rpc("job_report", { p_from: m1, p_to: m3 });
    ok("безплатен план: отчетът е в Pro", /Pro/.test(rep?.message ?? ""), rep?.message);

    const { error: foreign } = await other.c.from("jobs").insert({ ...job({}), craftsman_id: craft.id });
    ok("друг майстор не може да записва поръчки от чуждо име", Boolean(foreign));
    const { data: seen } = await other.c.from("jobs").select("id").eq("craftsman_id", craft.id);
    ok("друг майстор не вижда чужди поръчки", !seen || seen.length === 0);
    const { data: anonJobs } = await anon.from("jobs").select("id");
    ok("анонимен не вижда поръчки", !anonJobs || anonJobs.length === 0);

    // several days: all covered days are busy
    const { error: multiErr } = await craft.c.from("jobs").insert(job({ start_date: m2, end_date: m3, title: "Баня, 8 дни" }));
    ok("поръчка за няколко дни", !multiErr, multiErr);
    ok("първият ден от периода е зает", (await statusOf(m2)) === "busy");
    ok("последният ден от периода е зает", (await statusOf(m3)) === "busy");
    const { error: hoursMulti } = await craft.c.from("jobs").insert(job({ start_date: m2, end_date: m3, start_time: "09:00", end_time: "11:00" }));
    ok("часове за период от няколко дни не се приемат", Boolean(hoursMulti));

    // cancelling frees the days
    await craft.c.from("jobs").update({ status: "cancelled" }).eq("title", "Баня, 8 дни");
    ok("отменената поръчка освобождава дните", (await statusOf(m3)) === "free", await statusOf(m3));
    const { data: doneRow } = await craft.c.from("jobs").update({ status: "done" }).eq("id", j1!.id).select("done_at").single();
    ok("свършена поръчка получава време на приключване", Boolean(doneRow?.done_at));

    // chat bookings: overlap with a planned job is refused, multi-day works
    await craft.c.from("jobs").update({ status: "planned" }).eq("id", j1!.id);
    const { error: clash } = await craft.c.rpc("propose_booking", { p_conversation: convId, p_date: m1, p_kind: "work" });
    ok("уговорка върху зает от поръчка ден е отказана", /Вече имате/.test(clash?.message ?? ""), clash?.message);
    const { error: multiBook } = await craft.c.rpc("propose_booking", { p_conversation: convId, p_date: m2, p_end_date: m3, p_kind: "work", p_note: "ремонт" });
    ok("уговорка за няколко дни", !multiBook, multiBook);
    ok("потвърдена уговорка за няколко дни заема всички дни", (await statusOf(m2)) === "busy" && (await statusOf(m3)) === "busy");
    const { error: badInspect } = await craft.c.rpc("propose_booking", { p_conversation: convId, p_date: addIso(m3, 3), p_end_date: addIso(m3, 5), p_kind: "inspection" });
    ok("огледът не може да е за няколко дни", Boolean(badInspect));

    // Pro: details and the report
    await boss.c.rpc("admin_set_plan", { p_craftsman: craft.id, p_plan: "pro" });
    const { data: cl, error: cle } = await craft.c.from("craftsman_clients").insert({ craftsman_id: craft.id, name: "Петров", phone: "0888" }).select("id").single();
    ok("с Pro: клиентска карта", !cle && Boolean(cl), cle);
    const { data: j2, error: j2e } = await craft.c
      .from("jobs")
      .insert(job({ start_date: addIso(m3, 7), end_date: addIso(m3, 7), client_id: cl!.id, labor_price: 60, transport_price: 10, title: "Бойлер", status: "done" }))
      .select("id")
      .single();
    ok("с Pro: цени към поръчка", !j2e && Boolean(j2), j2e);
    const { error: matErr } = await craft.c.from("job_materials").insert({ job_id: j2!.id, craftsman_id: craft.id, name: "Бойлер 80 л", amount: 240 });
    ok("с Pro: материали", !matErr, matErr);
    const { data: other1 } = await other.c.from("craftsman_clients").select("id").eq("craftsman_id", craft.id);
    ok("друг майстор не вижда чужди клиенти", !other1 || other1.length === 0);
    const { error: stolen } = await craft.c.from("jobs").insert(job({ start_date: addIso(m3, 8), end_date: addIso(m3, 8), client_id: crypto.randomUUID() }));
    ok("поръчка към несъществуващ или чужд клиент се отказва", Boolean(stolen));
    const { data: report } = await craft.c.rpc("job_report", { p_from: m1, p_to: addIso(m3, 30) });
    const r = report as { done: number; labor: number; materials: number; transport: number } | null;
    ok("отчетът смята труд 60, транспорт 10 и материали 240 за свършените", r?.labor === 60 && r?.transport === 10 && r?.materials === 240, r);

    await boss.c.rpc("admin_set_plan", { p_craftsman: craft.id, p_plan: "free" });
    await admin.auth.admin.deleteUser(boss.id);
  }

  console.log("\nСнимки в чата");
  {
    const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    const upload = (c: typeof alice.c, path: string) => c.storage.from("chat-photos").upload(path, PNG, { contentType: "image/png" });
    const p1 = `${convId}/test-${Date.now()}-a.png`;
    const p2 = `${convId}/test-${Date.now()}-b.png`;

    const { error: upOk } = await upload(alice.c, p1);
    ok("участник качва снимка в своя разговор", !upOk, upOk);
    const { error: upCraft } = await upload(craft.c, p2);
    ok("и другият участник може да качва", !upCraft, upCraft);
    const { error: upOut } = await upload(bob.c, `${convId}/outsider.png`);
    ok("външен човек не може да качва в чужд разговор", Boolean(upOut));
    const { error: upAnon } = await upload(anon as typeof alice.c, `${convId}/anon.png`);
    ok("анонимен не може да качва", Boolean(upAnon));
    const { error: wrongType } = await alice.c.storage.from("chat-photos").upload(`${convId}/x.html`, new Blob(["<script>"], { type: "text/html" }), { contentType: "text/html" });
    ok("не приема файлове, които не са снимки", Boolean(wrongType));

    const { data: signed } = await craft.c.storage.from("chat-photos").createSignedUrl(p1, 60);
    ok("другият участник вижда снимката през подписан линк", Boolean(signed?.signedUrl), signed);
    const { data: bobSigned, error: bobSignErr } = await bob.c.storage.from("chat-photos").createSignedUrl(p1, 60);
    ok("външен човек не получава линк към снимката", Boolean(bobSignErr) || !bobSigned?.signedUrl, bobSigned);
    const { error: bobDl } = await bob.c.storage.from("chat-photos").download(p1);
    ok("външен човек не може да я свали", Boolean(bobDl));
    const { error: anonUrl } = await anon.storage.from("chat-photos").createSignedUrl(p1, 60);
    ok("анонимен не получава линк към снимката", Boolean(anonUrl));
    const publicTry = await fetch(`${URL}/storage/v1/object/public/chat-photos/${p1}`);
    ok("кофата не е публична", publicTry.status >= 400, publicTry.status);

    // messages with photos: only inside their own conversation folder, at most 6
    const { data: pm, error: pmErr } = await alice.c
      .from("messages")
      .insert({ conversation_id: convId, sender_id: alice.id, body: "📷 Снимка", meta: { photos: [{ path: p1 }] } })
      .select("id")
      .single();
    ok("съобщение със снимка", !pmErr && Boolean(pm), pmErr);
    const { error: foreignPath } = await alice.c.from("messages").insert({ conversation_id: convId, sender_id: alice.id, body: "x", meta: { photos: [{ path: `${crypto.randomUUID()}/x.png` }] } });
    ok("снимка от друг разговор се отказва", Boolean(foreignPath));
    const { error: manyPhotos } = await alice.c.from("messages").insert({ conversation_id: convId, sender_id: alice.id, body: "x", meta: { photos: Array.from({ length: 7 }, (_, n) => ({ path: `${convId}/${n}.png` })) } });
    ok("над 6 снимки в съобщение се отказват", Boolean(manyPhotos));
    const { error: traversal } = await alice.c.from("messages").insert({ conversation_id: convId, sender_id: alice.id, body: "x", meta: { photos: [{ path: `${convId}/../x.png` }] } });
    ok("път с .. се отказва", Boolean(traversal));

    // the craftsman asks, the client decides
    const { data: reqId, error: reqErr } = await craft.c.rpc("request_photo_share", { p_message: pm!.id, p_path: p1 });
    ok("майсторът пита за снимка на клиента", !reqErr && Boolean(reqId), reqErr);
    const { data: again } = await craft.c.rpc("request_photo_share", { p_message: pm!.id, p_path: p1 });
    ok("същата заявка не се дублира", again === reqId);
    const { error: clientAsks } = await alice.c.rpc("request_photo_share", { p_message: pm!.id, p_path: p1 });
    ok("клиентът не може да пита себе си", Boolean(clientAsks));
    const { error: notClients } = await craft.c.rpc("request_photo_share", { p_message: pm!.id, p_path: `${convId}/not-in-message.png` });
    ok("не се пита за снимка, която не е в съобщението", Boolean(notClients));
    const { error: earlyPublish } = await craft.c.rpc("mark_photo_share_published", { p_request: reqId });
    ok("без съгласие снимката не се отбелязва за публикуване", Boolean(earlyPublish));
    const { error: bobResp } = await bob.c.rpc("respond_photo_share", { p_request: reqId, p_accept: true });
    ok("външен човек не може да отговаря", Boolean(bobResp));
    const { error: craftResp } = await craft.c.rpc("respond_photo_share", { p_request: reqId, p_accept: true });
    ok("майсторът не може да отговаря вместо клиента", Boolean(craftResp));
    const { data: seenByBob } = await bob.c.from("photo_share_requests").select("id");
    ok("заявките не се виждат от външни", !seenByBob || seenByBob.length === 0);
    const { data: answer, error: ansErr } = await alice.c.rpc("respond_photo_share", { p_request: reqId, p_accept: true });
    ok("клиентът се съгласява", !ansErr && answer === "approved", ansErr);
    const { error: twice } = await alice.c.rpc("respond_photo_share", { p_request: reqId, p_accept: false });
    ok("не може да промени отговора", Boolean(twice));
    const { error: publish } = await craft.c.rpc("mark_photo_share_published", { p_request: reqId });
    ok("след съгласие майсторът отбелязва публикуване", !publish, publish);

    await alice.c.storage.from("chat-photos").remove([p1]);
    await craft.c.storage.from("chat-photos").remove([p2]);
  }

  console.log("\nИзвестия, отзив по линк и чистене");
  {
    // several messages in one conversation stay one notification and one pending e-mail
    await craft.c.rpc("mark_conversation_read", { p_conversation: convId });
    await alice.c.from("messages").insert({ conversation_id: convId, sender_id: alice.id, body: "Първо ново" });
    await alice.c.from("messages").insert({ conversation_id: convId, sender_id: alice.id, body: "Второ ново" });
    const { data: nm } = await craft.c.from("notifications").select("id, count, read_at, body").eq("conversation_id", convId).eq("kind", "message").is("read_at", null);
    ok("две съобщения стават едно известие", nm?.length === 1 && nm[0].count === 2 && nm[0].body === "Второ ново", nm);
    const { data: box } = await admin.from("email_outbox").select("sent_at, send_after, body").eq("notification_id", nm![0].id);
    ok("и едно чакащо писмо, с изчакване около 10 минути", box?.length === 1 && !box[0].sent_at && new Date(box[0].send_after).getTime() > Date.now() + 5 * 60_000 && /Второ ново/.test(box[0].body), box);

    const { data: peek } = await alice.c.from("notifications").select("id").eq("user_id", craft.id);
    ok("не се четат чужди известия", !peek || peek.length === 0);
    const { error: outboxErr, data: outboxRows } = await alice.c.from("email_outbox").select("id");
    ok("опашката с писма не се чете през API", Boolean(outboxErr) || !outboxRows || outboxRows.length === 0);

    // reading the conversation marks the notification read, so the worker will skip the e-mail
    await craft.c.rpc("mark_conversation_read", { p_conversation: convId });
    const { data: after } = await craft.c.from("notifications").select("read_at").eq("id", nm![0].id).single();
    ok("прочетен разговор → прочетено известие", Boolean(after?.read_at));

    // prefs: switched off → a new notification queues no e-mail
    const { error: prefErr } = await craft.c.from("notification_prefs").update({ email_messages: false }).eq("user_id", craft.id);
    ok("потребителят променя своите настройки за писма", !prefErr, prefErr);
    await alice.c.from("messages").insert({ conversation_id: convId, sender_id: alice.id, body: "Без писмо" });
    const { data: nn } = await craft.c.from("notifications").select("id").eq("conversation_id", convId).eq("kind", "message").is("read_at", null);
    const { data: noBox } = await admin.from("email_outbox").select("id").eq("notification_id", nn![0].id);
    ok("с изключени писма няма чакащо писмо", nn?.length === 1 && (noBox?.length ?? 0) === 0);
    const { data: prefs } = await admin.from("notification_prefs").select("unsub_token").eq("user_id", craft.id).single();
    await craft.c.from("notification_prefs").update({ email_messages: true }).eq("user_id", craft.id);
    const { data: unsub } = await anon.rpc("unsubscribe_emails", { p_token: prefs!.unsub_token });
    const { data: prefsAfter } = await admin.from("notification_prefs").select("email_messages, email_reviews").eq("user_id", craft.id).single();
    ok("линкът „спри писмата“ работи без вход", unsub === true && prefsAfter?.email_messages === false && prefsAfter?.email_reviews === false);

    const { data: bk } = await alice.c.from("notifications").select("id").eq("kind", "booking");
    ok("уговорка носи известие на другата страна", (bk?.length ?? 0) >= 1);
    const { data: marked } = await alice.c.rpc("mark_notifications_read");
    ok("mark_notifications_read отбелязва само моите", typeof marked === "number" && marked >= 1);

    // review request in the chat: the craftsman marks the work done, the client gets a message with the review button
    const { error: askErr } = await craft.c.rpc("request_review_in_chat", { p_conversation: convId });
    ok("майсторът праща покана за отзив в разговора", !askErr, askErr);
    const { data: askMsg } = await alice.c.from("messages").select("id").eq("conversation_id", convId).eq("meta->>event", "review_request");
    ok("клиентът вижда поканата за отзив в чата", (askMsg?.length ?? 0) === 1, askMsg);
    const { error: askAgain } = await craft.c.rpc("request_review_in_chat", { p_conversation: convId });
    ok("втора покана в рамките на 30 дни се отказва", Boolean(askAgain));
    const { error: askClient } = await alice.c.rpc("request_review_in_chat", { p_conversation: convId });
    ok("клиентът не може да праща покана за отзив", Boolean(askClient));
    const { error: askOther } = await other.c.rpc("request_review_in_chat", { p_conversation: convId });
    ok("чужд майстор не може да праща покана в чужд разговор", Boolean(askOther));
    const { error: askAnon } = await anon.rpc("request_review_in_chat", { p_conversation: convId });
    ok("анонимен не може да праща покана за отзив", Boolean(askAnon));
    const { data: revNotif } = await craft.c.from("notifications").select("title").eq("kind", "review");
    ok("майсторът получава известие за отзива", (revNotif?.length ?? 0) >= 1);

    // retention: 60 idle days wipe the texts; bookings, the conversation and the right to review stay
    const { count: msgsBefore } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", convId);
    await admin.from("conversations").update({ last_message_at: new Date(Date.now() - 61 * 86400_000).toISOString() }).eq("id", convId);
    const { data: purged } = await admin.rpc("cleanup_old_chats", { p_days: 60 });
    const { count: msgsAfter } = await admin.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", convId);
    ok("след 60 дни без разговор текстовете се изтриват", (msgsBefore ?? 0) > 0 && msgsAfter === 0 && (purged ?? 0) >= 1, { msgsBefore, msgsAfter, purged });
    const { data: queued } = await admin.from("chat_photo_purge_queue").select("conversation_id").eq("conversation_id", convId);
    ok("файловете на изчистен разговор влизат в опашка за триене", (queued?.length ?? 0) === 1);
    await admin.from("chat_photo_purge_queue").delete().eq("conversation_id", convId);
    const { data: kept } = await admin.from("conversations").select("messages_purged_at").eq("id", convId).single();
    ok("разговорът остава, с отбелязано чистене", Boolean(kept?.messages_purged_at));
    const { count: bookingsKept } = await admin.from("bookings").select("id", { count: "exact", head: true }).eq("conversation_id", convId);
    ok("уговорките остават", (bookingsKept ?? 0) > 0);
    const { data: canStill } = await alice.c.rpc("can_review", { p_craftsman: craft.id });
    ok("правото на отзив остава след чистенето", canStill === true);
    const { data: freshPurge } = await admin.rpc("cleanup_old_chats", { p_days: 60 });
    ok("второ пускане не пипа вече изчистените", (freshPurge ?? 0) === 0);
  }

  console.log("\nСтатистика");
  {
    const slug = (await admin.from("craftsman_profiles").select("slug").eq("id", craft.id).single()).data!.slug;
    const stats = async (c: typeof craft.c) => (await c.rpc("my_stats", { p_weeks: 4 })).data as {
      detail: boolean;
      totals: { views: number; impressions: number; phone_reveals: number; inquiries: number };
      weeks: unknown[];
      response: { inquiries: number; replied: number };
    };
    const before = await stats(craft.c);
    await anon.rpc("record_profile_view", { p_slug: slug });
    await bob.c.rpc("record_profile_view", { p_slug: slug });
    await craft.c.rpc("record_profile_view", { p_slug: slug }); // the owner's own view is not counted
    await anon.rpc("record_impressions", { p_ids: [craft.id, craft.id] });
    await anon.rpc("record_profile_view", { p_slug: "no-such-slug" });
    const after = await stats(craft.c);
    ok("прегледите се броят, без собствените", after.totals.views === before.totals.views + 2, { before: before.totals.views, after: after.totals.views });
    ok("показванията в списък се броят веднъж на заявка", after.totals.impressions === before.totals.impressions + 1, after.totals);
    ok("безплатният план няма седмична разбивка", after.detail === false && after.weeks.length === 0);

    await admin.from("craftsman_profiles").update({ phone_visibility: "public" }).eq("id", craft.id);
    const { data: ph } = await anon.rpc("reveal_phone", { p_craftsman: craft.id });
    await craft.c.rpc("reveal_phone", { p_craftsman: craft.id }); // own reveal is not counted
    const afterPhone = await stats(craft.c);
    ok("разкриването на телефон се брои", Boolean(ph) && afterPhone.totals.phone_reveals === after.totals.phone_reveals + 1, afterPhone.totals);
    await admin.from("craftsman_profiles").update({ phone_visibility: "hidden" }).eq("id", craft.id);
    const { data: hiddenPh } = await anon.rpc("reveal_phone", { p_craftsman: craft.id });
    const afterHidden = await stats(craft.c);
    ok("скрит телефон не се разкрива и не се брои", hiddenPh === null && afterHidden.totals.phone_reveals === afterPhone.totals.phone_reveals);

    const { data: foreignStats } = await other.c.from("daily_stats").select("views").eq("craftsman_id", craft.id);
    ok("друг майстор не вижда чужди броячи", !foreignStats || foreignStats.length === 0);
    const { error: writeStat } = await craft.c.from("daily_stats").update({ views: 999 }).eq("craftsman_id", craft.id);
    const { data: still } = await admin.from("daily_stats").select("views").eq("craftsman_id", craft.id);
    ok("майсторът не може да си пише броячите", Boolean(writeStat) || (still ?? []).every((r) => r.views < 999));
    const { error: anonStats } = await anon.rpc("my_stats");
    ok("анонимен няма статистика", Boolean(anonStats));
    ok("отговорите се смятат от разговорите", after.response.inquiries >= 1 && after.response.replied >= 1, after.response);

    const boss = await user("client", "boss3");
    await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);
    await boss.c.rpc("admin_set_plan", { p_craftsman: craft.id, p_plan: "pro" });
    const pro = await stats(craft.c);
    ok("с Pro има седмична разбивка", pro.detail === true && pro.weeks.length === 4, pro.weeks.length);
    await boss.c.rpc("admin_set_plan", { p_craftsman: craft.id, p_plan: "free" });
    await admin.auth.admin.deleteUser(boss.id);
  }

  console.log("\nДоклади и защита от спам");
  {
    const boss = await user("client", "boss4");
    await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);

    const { error: rep1 } = await alice.c.rpc("report_content", { p_type: "profile", p_target: craft.id, p_reason: "spam", p_details: "тест" });
    ok("клиент докладва профил", !rep1, rep1);
    await alice.c.rpc("report_content", { p_type: "profile", p_target: craft.id, p_reason: "spam" });
    const { data: rows } = await admin.from("reports").select("id").eq("reporter_id", alice.id).eq("target_user", craft.id);
    ok("същият доклад не се дублира", rows?.length === 1, rows?.length);
    const { error: self } = await craft.c.rpc("report_content", { p_type: "profile", p_target: craft.id, p_reason: "spam" });
    ok("не може да докладваш себе си", Boolean(self));
    const { error: badReason } = await alice.c.rpc("report_content", { p_type: "profile", p_target: other.id, p_reason: "хаха" });
    ok("невалидна причина се отказва", Boolean(badReason));
    const { error: anonRep } = await anon.rpc("report_content", { p_type: "profile", p_target: craft.id, p_reason: "spam" });
    ok("анонимен не докладва", Boolean(anonRep));
    const { error: otherConv } = await bob.c.rpc("report_content", { p_type: "conversation", p_target: convId, p_reason: "spam" });
    ok("не се докладва чужд разговор", Boolean(otherConv));
    const { data: asBoss } = await boss.c.from("reports").select("id").eq("target_user", craft.id);
    ok("админ вижда докладите", (asBoss?.length ?? 0) >= 1);
    const { data: asAlice } = await alice.c.from("reports").select("id");
    ok("обикновен потребител не чете доклади", !asAlice || asAlice.length === 0);

    const logId = `test-${Date.now()}`;
    const { error: logErr } = await boss.c.rpc("log_admin_action", { p_action: "test", p_target_type: "user", p_target_id: logId });
    const { error: logDenied } = await alice.c.rpc("log_admin_action", { p_action: "test", p_target_id: logId });
    const { data: logRows } = await boss.c.from("admin_log").select("id").eq("target_id", logId);
    ok("админ записва в дневника, останалите не могат", !logErr && Boolean(logDenied) && (logRows?.length ?? 0) === 1);
    await admin.from("admin_log").delete().eq("target_id", logId);
    const { data: aliceLog } = await alice.c.from("admin_log").select("id");
    ok("дневникът не се чете от обикновени потребители", !aliceLog || aliceLog.length === 0);

    // rate limit: 20 messages a minute
    const spammer = await user("client", "spammer");
    const { data: spConv, error: spErr } = await spammer.c.rpc("start_conversation", { p_craftsman: craft.id, p_body: "Здравейте, имам въпрос" });
    ok("нов клиент започва разговор", !spErr && Boolean(spConv), spErr);
    let firstBlock = 0;
    for (let n = 2; n <= 25; n++) {
      const { error } = await spammer.c.from("messages").insert({ conversation_id: spConv, sender_id: spammer.id, body: `съобщение номер ${n}` });
      if (error && !firstBlock) firstBlock = n;
    }
    ok("над 20 съобщения в минута се отказват", firstBlock === 21, firstBlock);

    // three links in one message
    const tidy = await user("client", "tidy");
    const { data: tConv } = await tidy.c.rpc("start_conversation", { p_craftsman: craft.id, p_body: "Здравейте" });
    const { error: links } = await tidy.c.from("messages").insert({ conversation_id: tConv, sender_id: tidy.id, body: "http://a.bg http://b.bg http://c.bg" });
    ok("съобщение с 3 линка се отказва", /линкове/.test(links?.message ?? ""), links?.message);
    const { error: oneLink } = await tidy.c.from("messages").insert({ conversation_id: tConv, sender_id: tidy.id, body: "Снимка на проблема: https://example.com/x" });
    ok("един линк е позволен", !oneLink, oneLink);

    // the same text to many craftsmen in an hour
    const dupe = await user("client", "dupe");
    const extra: string[] = [];
    for (let n = 0; n < 9; n++) {
      const { data } = await admin.auth.admin.createUser({
        email: `dupe-craft-${n}-${Date.now()}@maistorko.test`,
        password: PASS,
        email_confirm: true,
        user_metadata: { full_name: `Майстор ${n}`, role: "craftsman", city: "sofia" },
      });
      extra.push(data.user!.id);
      await admin.from("conversations").insert({ client_id: dupe.id, craftsman_id: data.user!.id });
    }
    const { data: dConvs } = await admin.from("conversations").select("id").eq("client_id", dupe.id);
    const text = "Здравейте, трябва ми ремонт на баня, пишете ми цена";
    let sent = 0;
    let blockedMsg = "";
    for (const c of dConvs ?? []) {
      const { error } = await dupe.c.from("messages").insert({ conversation_id: c.id, sender_id: dupe.id, body: text });
      if (error) {
        blockedMsg = error.message;
        break;
      }
      sent++;
    }
    ok("същият текст до много майстори се спира (след 8)", sent === 8 && /едно и също/.test(blockedMsg), { sent, blockedMsg });
    const { data: autoFlag } = await boss.c.from("reports").select("details").eq("target_user", dupe.id).is("reporter_id", null);
    ok("спирането оставя автоматичен доклад за админите", (autoFlag?.length ?? 0) === 1, autoFlag);

    for (const id of [...extra, spammer.id, tidy.id, dupe.id, boss.id]) await admin.auth.admin.deleteUser(id);
  }

  console.log("\nЧестно класиране");
  {
    type Sig = { craftsman_id: string; r: number; p: number; f: number; q: number; n: number; e: number };
    const signals = async (ids: string[]) => ((await admin.rpc("rank_signals", { p_ids: ids })).data ?? []) as Sig[];
    const pick = (rows: Sig[], id: string) => rows.find((r) => r.craftsman_id === id)!;

    // one review of 5.0 does not beat forty of 4.8
    await admin.from("craftsman_profiles").update({ rating_avg: 5, rating_count: 1 }).eq("id", craft.id);
    await admin.from("craftsman_profiles").update({ rating_avg: 4.8, rating_count: 40 }).eq("id", other.id);
    let sig = await signals([craft.id, other.id]);
    ok("рейтингът е предпазлив: 40 отзива с 4,8 бият 1 отзив с 5,0", Number(pick(sig, other.id).r) > Number(pick(sig, craft.id).r), sig.map((x) => x.r));

    // newcomer bonus only for new craftsmen with few reviews, fading with age
    await admin.from("craftsman_profiles").update({ created_at: new Date(Date.now() - 200 * 86400_000).toISOString() }).eq("id", other.id);
    sig = await signals([craft.id, other.id]);
    ok("бонусът за нов е само за нови с малко отзиви", Number(pick(sig, craft.id).n) > 0.1 && Number(pick(sig, other.id).n) === 0, sig.map((x) => x.n));

    // an old calendar scores 0 for freshness
    await admin.from("craftsman_profiles").update({ last_confirmed_at: new Date(Date.now() - 40 * 86400_000).toISOString() }).eq("id", other.id);
    sig = await signals([craft.id, other.id]);
    ok("календар без потвърждение 40 дни носи 0 точки, пресен календар около 1", Number(pick(sig, other.id).f) === 0 && Number(pick(sig, craft.id).f) > 0.9, sig.map((x) => x.f));

    // answering quickly beats having no history (prior 4 of 5)
    sig = await signals([craft.id, other.id]);
    ok("отговорил бързо е над този без история", Number(pick(sig, craft.id).p) > Number(pick(sig, other.id).p), sig.map((x) => x.p));
    ok("всички показатели са в границите си", sig.every((x) => [x.r, x.p, x.f, x.q].every((v) => Number(v) >= 0 && Number(v) <= 1.0001) && Number(x.n) <= 0.15));

    // determinism: the same seed gives the same order, and the function is open to the public
    const order = async (seed: string | null, ids: string[]) =>
      ((await anon.rpc("search_craftsmen", { p_sort: "recommended", p_ids: ids, p_seed: seed ?? undefined, p_limit: 20 })).data ?? []).map((r: { id: string }) => r.id);
    ok("rank_signals не е достъпна през API", Boolean((await anon.rpc("rank_signals", { p_ids: [craft.id] })).error));

    // exposure fairness with two identical craftsmen: the one shown far more moves down
    const clones: string[] = [];
    for (let n = 0; n < 2; n++) {
      const { data } = await admin.auth.admin.createUser({
        email: `clone-${n}-${Date.now()}@maistorko.test`,
        password: PASS,
        email_confirm: true,
        user_metadata: { full_name: `Клон ${n}`, role: "craftsman", city: "sofia" },
      });
      const id = data.user!.id;
      clones.push(id);
      await admin.from("craftsman_profiles").update({ quote_on_inspection: true, bio: "Еднакво описание", rating_avg: 0, rating_count: 0 }).eq("id", id);
      await admin.from("craftsman_categories").insert({ craftsman_id: id, category_id: cat!.id });
      await admin.from("availability_rules").insert({ craftsman_id: id, weekday: 1, start_time: "08:00", end_time: "17:00" });
      await admin.from("craftsman_profiles").update({ last_confirmed_at: new Date().toISOString(), created_at: "2026-01-01T00:00:00Z" }).eq("id", id);
    }
    clones.sort();
    // same seed -> same order; different seeds take turns between equal craftsmen
    const o1 = await order("seed-1", clones);
    const o2 = await order("seed-1", clones);
    ok("същото семе дава същия ред", o1.length === 2 && JSON.stringify(o1) === JSON.stringify(o2), { o1, o2 });
    const firsts = new Set<string>();
    for (let n = 0; n < 14; n++) firsts.add((await order(`seed-${n}`, clones))[0]);
    ok("при равни оценки различните семена дават различен първи", firsts.size === 2, [...firsts]);
    const base = await order(null, clones);
    ok("еднакви майстори без показвания: редът е предвидим", base.length === 2 && base[0] === clones[0], base);
    const day = new Date().toISOString().slice(0, 10);
    await admin.from("daily_stats").upsert({ craftsman_id: clones[0], day, impressions: 500, exposure: 400 });
    const flipped = await order(null, clones);
    ok("който е бил показван много, слиза пред равен на него", flipped[0] === clones[1], flipped);
    await admin.from("daily_stats").upsert({ craftsman_id: clones[1], day, impressions: 500, exposure: 400 });
    const even = await order(null, clones);
    ok("при равна видимост редът се връща", even[0] === clones[0], even);

    // the recorded exposure follows position: first place is worth more than the tenth
    await anon.rpc("record_impressions", { p_ids: [clones[0], clones[1]], p_offset: 0 });
    const { data: ex } = await admin.from("daily_stats").select("craftsman_id, exposure").in("craftsman_id", clones);
    const e0 = Number(ex?.find((r) => r.craftsman_id === clones[0])?.exposure);
    const e1 = Number(ex?.find((r) => r.craftsman_id === clones[1])?.exposure);
    ok("първо място носи повече видимост от второ", e0 - 400 > e1 - 400 && e0 - 400 > 0.99, { e0, e1 });

    for (const id of clones) await admin.auth.admin.deleteUser(id);
    await admin.from("craftsman_profiles").update({ rating_avg: 0, rating_count: 0 }).eq("id", craft.id);
  }

  console.log("\nФирми");
  {
    const boss = await user("client", "boss5");
    await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);
    const ownerU = await user("client", "owner");
    const mgrU = await user("client", "manager");
    const empU = await user("client", "employee");
    const emp2U = await user("client", "employee2");
    const owner2 = await user("client", "owner2");

    // creating a company is for admins
    const { error: notAdmin } = await alice.c.rpc("admin_create_org", { p_name: "Нелегална ООД" });
    ok("само админ създава фирма", Boolean(notAdmin));
    const { data: created, error: createErr } = await boss.c.rpc("admin_create_org", { p_name: "Тест Ремонти ЕООД", p_eik: "123456789", p_city: "sofia" });
    const org = created as { id: string; slug: string; owner_token: string };
    ok("админ създава фирма и получава покана за собственика", !createErr && Boolean(org?.owner_token), createErr);
    const { data: bad } = await boss.c.rpc("admin_create_org", { p_name: "Лош ЕИК", p_eik: "12ab" });
    ok("невалиден ЕИК се отказва", !bad);

    // owner invite: public info, one use
    const { data: pubInfo } = await anon.rpc("org_invite_info", { p_token: org.owner_token });
    ok("поканата показва само име на фирма, роля и състояние", pubInfo?.[0]?.org_name === "Тест Ремонти ЕООД" && pubInfo[0].state === "open" && !JSON.stringify(pubInfo).includes(org.id), pubInfo);
    const { error: anonClaim } = await anon.rpc("claim_org_invite", { p_token: org.owner_token });
    ok("поканата се приема само с вход", Boolean(anonClaim));
    const { data: ownerSlug, error: claimErr } = await ownerU.c.rpc("claim_org_invite", { p_token: org.owner_token });
    ok("собственикът приема поканата", !claimErr && ownerSlug === org.slug, claimErr);
    const { error: reuse } = await mgrU.c.rpc("claim_org_invite", { p_token: org.owner_token });
    ok("поканата е за еднократна употреба", Boolean(reuse));

    // employees are invited by the owner; a craftsman profile is created with the prepared name
    const { data: tok1, error: inv1 } = await ownerU.c.rpc("create_org_invite", { p_full_name: "Иван Тестов", p_role: "craftsman" });
    ok("собственикът кани майстор", !inv1 && Boolean(tok1), inv1);
    const { error: outsiderInvite } = await alice.c.rpc("create_org_invite", { p_full_name: "Х" });
    ok("външен човек не може да кани", Boolean(outsiderInvite));
    await empU.c.rpc("claim_org_invite", { p_token: tok1 });
    const { data: empProfile } = await admin.from("craftsman_profiles").select("display_name").eq("id", empU.id).maybeSingle();
    ok("поканеният става майстор с подготвеното име", empProfile?.display_name === "Иван Тестов", empProfile);
    const { data: tok2 } = await ownerU.c.rpc("create_org_invite", { p_full_name: "Втори", p_role: "craftsman" });
    const { error: twoOrgs } = await empU.c.rpc("claim_org_invite", { p_token: tok2 });
    ok("човек не може да е в две фирми", Boolean(twoOrgs));
    await emp2U.c.rpc("claim_org_invite", { p_token: tok2 });

    // manager role: given by the owner; managers invite craftsmen but not managers
    const { data: tokM } = await ownerU.c.rpc("create_org_invite", { p_full_name: "Диспечер", p_role: "manager" });
    await mgrU.c.rpc("claim_org_invite", { p_token: tokM });
    const { error: mgrInvMgr } = await mgrU.c.rpc("create_org_invite", { p_role: "manager" });
    ok("мениджър не може да добавя мениджъри", Boolean(mgrInvMgr));
    const { error: mgrInvCraft } = await mgrU.c.rpc("create_org_invite", { p_full_name: "Нов", p_role: "craftsman" });
    ok("мениджър кани майстори", !mgrInvCraft, mgrInvCraft);
    const { error: empInv } = await empU.c.rpc("create_org_invite", { p_full_name: "Х" });
    ok("майстор не може да кани", Boolean(empInv));
    const { error: ownerInvite } = await ownerU.c.rpc("create_org_invite", { p_role: "owner" });
    ok("нов собственик не се прави с покана на собственика", Boolean(ownerInvite));

    // what a manager can reach: the employee's calendar and jobs, not other companies' people
    const { error: ruleOk } = await mgrU.c.from("availability_rules").insert({ craftsman_id: empU.id, weekday: 3, start_time: "09:00", end_time: "13:00" });
    ok("мениджър записва график на майстор от фирмата", !ruleOk, ruleOk);
    const { data: ownRules } = await empU.c.from("availability_rules").select("weekday").eq("craftsman_id", empU.id);
    ok("майсторът вижда този график", ownRules?.length === 1);
    const { error: foreignRule } = await owner2.c.from("availability_rules").insert({ craftsman_id: empU.id, weekday: 4, start_time: "09:00", end_time: "13:00" });
    ok("собственик на друга фирма не пише в графика му", Boolean(foreignRule));
    const { error: outsiderRule } = await alice.c.from("availability_rules").insert({ craftsman_id: empU.id, weekday: 4, start_time: "09:00", end_time: "13:00" });
    ok("и обикновен потребител не може", Boolean(outsiderRule));
    const { error: jobOk } = await mgrU.c.from("jobs").insert({ craftsman_id: empU.id, title: "Поръчка от диспечера", start_date: "2031-03-03", end_date: "2031-03-03" });
    ok("мениджър разпределя поръчка на майстор", !jobOk, jobOk);
    const { data: seenJob } = await empU.c.from("jobs").select("title").eq("craftsman_id", empU.id);
    ok("майсторът я вижда", seenJob?.length === 1);
    const { data: foreignJobs } = await owner2.c.from("jobs").select("id").eq("craftsman_id", empU.id);
    ok("друга фирма не вижда поръчките му", !foreignJobs || foreignJobs.length === 0);
    const { error: svcBlock } = await mgrU.c.from("services").insert({ craftsman_id: empU.id, name: "Не бива", price_kind: "quote" });
    ok("профилът на майстора (услуги) остава негов", Boolean(svcBlock));

    // confirming the calendar of an employee
    await admin.from("craftsman_profiles").update({ last_confirmed_at: new Date(Date.now() - 20 * 86400_000).toISOString() }).eq("id", empU.id);
    const { error: confirmOk } = await mgrU.c.rpc("confirm_calendar", { p_craftsman: empU.id });
    const { data: confirmed } = await admin.from("craftsman_profiles").select("last_confirmed_at").eq("id", empU.id).single();
    ok("мениджър потвърждава календара на майстор", !confirmOk && Date.now() - new Date(confirmed!.last_confirmed_at).getTime() < 60_000, confirmOk);
    const { error: confirmForeign } = await owner2.c.rpc("confirm_calendar", { p_craftsman: empU.id });
    ok("друга фирма не потвърждава чужд календар", Boolean(confirmForeign));
    const { error: confirmAlice } = await alice.c.rpc("confirm_calendar", { p_craftsman: empU.id });
    ok("и обикновен потребител не може", Boolean(confirmAlice));

    // company plan: Pro features for the employee while the plan is active
    const { data: planOn } = await admin.rpc("craftsman_plan", { p_craftsman: empU.id });
    const { data: featOn } = await admin.rpc("has_feature", { p_craftsman: empU.id, p_feature: "job_details" });
    ok("майсторът във фирма получава плана на фирмата", planOn === "company" && featOn === true, planOn);
    await boss.c.rpc("admin_update_org", { p_org: org.id, p_plan_status: "paused" });
    const { data: planOff } = await admin.rpc("craftsman_plan", { p_craftsman: empU.id });
    ok("със спрян план на фирмата майсторът е безплатен", planOff === "free", planOff);
    await boss.c.rpc("admin_update_org", { p_org: org.id, p_plan_status: "active" });

    // company profile editing
    const { error: nameOk } = await mgrU.c.from("organizations").update({ name: "Тест Ремонти и Монтаж", description: "Работим в София" }).eq("id", org.id);
    ok("мениджър редактира профила на фирмата", !nameOk, nameOk);
    const { error: verifyBlock } = await mgrU.c.from("organizations").update({ is_verified: true }).eq("id", org.id);
    const { data: stillUnverified } = await admin.from("organizations").select("is_verified").eq("id", org.id).single();
    ok("фирмата не може сама да се обяви за проверена", Boolean(verifyBlock) || stillUnverified?.is_verified === false);
    const { error: outsiderEdit } = await alice.c.from("organizations").update({ name: "Хакнато" }).eq("id", org.id);
    const { data: nameNow } = await admin.from("organizations").select("name").eq("id", org.id).single();
    ok("външен човек не редактира фирма", Boolean(outsiderEdit) || nameNow?.name !== "Хакнато");
    await boss.c.rpc("admin_update_org", { p_org: org.id, p_verified: true });
    const { data: pubOrg } = await anon.from("organizations").select("name, is_verified").eq("id", org.id).single();
    ok("публично се вижда проверената фирма", pubOrg?.is_verified === true);

    // members: who is visible
    const { data: seenByOwner } = await ownerU.c.from("organization_members").select("user_id, role").eq("organization_id", org.id);
    ok("членовете на фирмата виждат екипа си", seenByOwner?.length === 4, seenByOwner?.length);
    const { data: seenByOutsider } = await alice.c.from("organization_members").select("user_id").eq("organization_id", org.id);
    ok("външен не вижда непубликуван екип", !seenByOutsider || seenByOutsider.length === 0);
    const { data: invitesSeen } = await empU.c.from("organization_invites").select("token").eq("organization_id", org.id);
    ok("майсторът не вижда поканите", !invitesSeen || invitesSeen.length === 0);

    // removing and leaving
    const { error: rmOwner } = await mgrU.c.rpc("remove_org_member", { p_user: ownerU.id });
    ok("собственикът не може да бъде махнат", Boolean(rmOwner));
    const { error: roleBlock } = await mgrU.c.rpc("set_member_role", { p_user: emp2U.id, p_role: "manager" });
    ok("роли сменя само собственикът", Boolean(roleBlock));
    const { error: roleOk } = await ownerU.c.rpc("set_member_role", { p_user: emp2U.id, p_role: "manager" });
    ok("собственикът прави мениджър от майстор", !roleOk, roleOk);
    const { error: leaveOwner } = await ownerU.c.rpc("leave_org");
    ok("собственикът не може да напусне", Boolean(leaveOwner));
    const { error: rmEmp } = await mgrU.c.rpc("remove_org_member", { p_user: empU.id });
    ok("мениджър маха майстор", !rmEmp, rmEmp);
    const { error: afterRemove } = await mgrU.c.from("availability_rules").insert({ craftsman_id: empU.id, weekday: 5, start_time: "09:00", end_time: "13:00" });
    ok("махнатият вече не е достъпен за мениджъра", Boolean(afterRemove));
    const { data: planAfter } = await admin.rpc("craftsman_plan", { p_craftsman: empU.id });
    ok("и губи плана на фирмата", planAfter === "free", planAfter);
    const { data: keepsProfile } = await admin.from("craftsman_profiles").select("id").eq("id", empU.id).maybeSingle();
    ok("профилът на майстора остава негов", Boolean(keepsProfile));
    const { error: leave } = await emp2U.c.rpc("leave_org");
    ok("служител напуска сам", !leave, leave);

    for (const id of [boss.id, ownerU.id, mgrU.id, empU.id, emp2U.id, owner2.id]) await admin.auth.admin.deleteUser(id);
    await admin.from("organizations").delete().eq("id", org.id);
  }

  console.log("\nЧат с фирма");
  {
    const boss = await user("client", "boss6");
    await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);
    const ownerU = await user("client", "owner3");
    const mgrU = await user("client", "manager3");
    const empU = await user("client", "employee3");
    const clientU = await user("client", "client3");
    const { data: created } = await boss.c.rpc("admin_create_org", { p_name: "Чат Тест ООД" });
    const org = created as { id: string; owner_token: string };
    await ownerU.c.rpc("claim_org_invite", { p_token: org.owner_token });
    const { data: tm } = await ownerU.c.rpc("create_org_invite", { p_full_name: "Диспечер", p_role: "manager" });
    await mgrU.c.rpc("claim_org_invite", { p_token: tm });
    const { data: te } = await ownerU.c.rpc("create_org_invite", { p_full_name: "Майстор", p_role: "craftsman" });
    await empU.c.rpc("claim_org_invite", { p_token: te });

    const { data: conv, error: startErr } = await clientU.c.rpc("start_org_conversation", { p_org: org.id, p_body: "Здравейте, имам нужда от ремонт на баня" });
    ok("клиент пише на фирмата", !startErr && Boolean(conv), startErr);
    const { data: again } = await clientU.c.rpc("start_org_conversation", { p_org: org.id, p_body: "И още нещо" });
    ok("втори път стига до същия разговор", again === conv);
    const { error: ownErr } = await mgrU.c.rpc("start_org_conversation", { p_org: org.id, p_body: "аз" });
    ok("служител не пише на собствената си фирма", Boolean(ownErr));
    await admin.from("organizations").update({ is_hidden: true }).eq("id", org.id);
    const { error: hiddenErr } = await bob.c.rpc("start_org_conversation", { p_org: org.id, p_body: "Здравейте" });
    ok("на скрита фирма не се пише", Boolean(hiddenErr));
    await admin.from("organizations").update({ is_hidden: false }).eq("id", org.id);

    const canRead = async (c: typeof alice.c) => ((await c.from("conversations").select("id").eq("id", conv)).data?.length ?? 0) === 1;
    const msgCount = async (c: typeof alice.c) => (await c.from("messages").select("id").eq("conversation_id", conv)).data?.length ?? 0;
    ok("мениджърът чете разговора с фирмата", (await canRead(mgrU.c)) && (await msgCount(mgrU.c)) >= 2);
    ok("и собственикът", await canRead(ownerU.c));
    ok("майстор, на когото не е възложен, не го чете", !(await canRead(empU.c)) && (await msgCount(empU.c)) === 0);
    ok("външен човек не го чете", !(await canRead(bob.c)) && (await msgCount(bob.c)) === 0);
    ok("клиентът си чете разговора", await canRead(clientU.c));

    const { data: mine } = await mgrU.c.rpc("my_conversations");
    const mgrRow = (mine ?? []).find((r: { id: string }) => r.id === conv);
    ok("в списъка на мениджъра е разговор с клиента от името на фирмата", mgrRow?.org_name === "Чат Тест ООД" && mgrRow?.partner_name === "Тест client3", mgrRow);
    const { data: theirs } = await clientU.c.rpc("my_conversations");
    ok("в списъка на клиента партньорът е фирмата", (theirs ?? []).find((r: { id: string }) => r.id === conv)?.partner_name === "Чат Тест ООД");

    const { error: mgrSend } = await mgrU.c.from("messages").insert({ conversation_id: conv, sender_id: mgrU.id, body: "Здравейте, ще Ви намерим майстор" });
    ok("мениджърът отговаря", !mgrSend, mgrSend);
    const { data: clientNotif } = await clientU.c.from("notifications").select("title").eq("conversation_id", conv).eq("kind", "message");
    ok("клиентът получава известие от името на фирмата", (clientNotif ?? []).some((n) => /Чат Тест ООД/.test(n.title)), clientNotif);
    const { data: staffNotif } = await mgrU.c.from("notifications").select("title").eq("conversation_id", conv);
    ok("мениджърът е известен за съобщението на клиента", (staffNotif?.length ?? 0) >= 1, staffNotif);
    const { error: empSend } = await empU.c.from("messages").insert({ conversation_id: conv, sender_id: empU.id, body: "аз пиша" });
    ok("невъзложен майстор не може да пише в него", Boolean(empSend));
    const { error: outsiderSend } = await bob.c.from("messages").insert({ conversation_id: conv, sender_id: bob.id, body: "аз пиша" });
    ok("външен не може да пише", Boolean(outsiderSend));

    // handing the conversation over
    const { error: bookBefore } = await mgrU.c.rpc("propose_booking", { p_conversation: conv, p_date: addIso(new Date().toISOString().slice(0, 10), 10), p_kind: "inspection" });
    ok("преди възлагане не се уговаря час", /възложете/.test(bookBefore?.message ?? ""), bookBefore?.message);
    const { error: clientAssign } = await clientU.c.rpc("assign_org_conversation", { p_conversation: conv, p_craftsman: empU.id });
    ok("клиентът не възлага", Boolean(clientAssign));
    const { error: wrongPerson } = await mgrU.c.rpc("assign_org_conversation", { p_conversation: conv, p_craftsman: bob.id });
    ok("не може да се възложи на човек извън фирмата", Boolean(wrongPerson));
    const { error: assignOk } = await mgrU.c.rpc("assign_org_conversation", { p_conversation: conv, p_craftsman: empU.id });
    ok("мениджърът възлага разговора на майстор", !assignOk, assignOk);
    ok("възложеният майстор вече го чете", (await canRead(empU.c)) && (await msgCount(empU.c)) >= 3);
    const { data: empList } = await empU.c.rpc("my_conversations");
    ok("и го вижда в списъка си", (empList ?? []).some((r: { id: string }) => r.id === conv));
    const { error: empReply } = await empU.c.from("messages").insert({ conversation_id: conv, sender_id: empU.id, body: "Здравейте, аз съм майсторът" });
    ok("възложеният майстор отговаря", !empReply, empReply);
    const { data: bookId, error: bookErr } = await empU.c.rpc("propose_booking", { p_conversation: conv, p_date: addIso(new Date().toISOString().slice(0, 10), 10), p_kind: "inspection" });
    ok("възложеният майстор уговаря оглед", !bookErr && Boolean(bookId), bookErr);
    const { data: bk } = await admin.from("bookings").select("craftsman_id, status").eq("id", bookId).single();
    ok("уговорката е на майстора, не на фирмата", bk?.craftsman_id === empU.id && bk?.status === "confirmed", bk);

    // photos in a company conversation: staff and the client only
    const PNG = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
    const { error: staffUp } = await mgrU.c.storage.from("chat-photos").upload(`${conv}/staff-${Date.now()}.png`, PNG, { contentType: "image/png" });
    ok("мениджърът качва снимка в разговора с фирмата", !staffUp, staffUp);
    const { error: outUp } = await bob.c.storage.from("chat-photos").upload(`${conv}/out-${Date.now()}.png`, PNG, { contentType: "image/png" });
    ok("външен не качва", Boolean(outUp));

    // taking it back
    await mgrU.c.rpc("assign_org_conversation", { p_conversation: conv, p_craftsman: null });
    ok("след връщане майсторът губи достъп", !(await canRead(empU.c)));
    ok("мениджърът го чете и след това", await canRead(mgrU.c));

    // personal chats stay private to managers
    const { data: pconv } = await clientU.c.rpc("start_conversation", { p_craftsman: empU.id, p_body: "Лично съобщение до майстора" });
    const { data: mgrSees } = await mgrU.c.from("conversations").select("id").eq("id", pconv);
    ok("личният чат на майстора не се чете от мениджъра", !mgrSees || mgrSees.length === 0);
    const { data: mgrMsgs } = await mgrU.c.from("messages").select("id").eq("conversation_id", pconv);
    ok("и съобщенията му не се четат", !mgrMsgs || mgrMsgs.length === 0);

    const { data: files } = await admin.storage.from("chat-photos").list(conv as string);
    if (files?.length) await admin.storage.from("chat-photos").remove(files.map((f) => `${conv}/${f.name}`));
    for (const id of [boss.id, ownerU.id, mgrU.id, empU.id, clientU.id]) await admin.auth.admin.deleteUser(id);
    await admin.from("organizations").delete().eq("id", org.id);
  }

  console.log("\nОферти, тетрадка с клиенти, бързи отговори");
  {
    const boss = await user("client", "boss4");
    await admin.from("profiles").update({ role: "admin" }).eq("id", boss.id);
    const lines = [{ name: "Смяна на сифон", amount: "40.00", kind: "service" }, { name: "Сифон", amount: "12.50", kind: "material" }];
    const { error: freeOffer } = await craft.c.from("offers").insert({ craftsman_id: craft.id, title: "Оферта", lines });
    ok("безплатен план не може да прави оферти", Boolean(freeOffer));
    await boss.c.rpc("admin_set_plan", { p_craftsman: craft.id, p_plan: "pro" });

    const { data: offer, error: offerErr } = await craft.c.from("offers").insert({ craftsman_id: craft.id, title: "Оферта: баня", lines, start_date: "2030-02-01", end_date: "2030-02-02" }).select("id, token, total").single();
    ok("Pro прави оферта", !offerErr && Boolean(offer), offerErr);
    ok("общата сума се смята в базата", Number(offer?.total) === 52.5, offer);
    const { error: badLine } = await craft.c.from("offers").insert({ craftsman_id: craft.id, title: "Лоша", lines: [{ name: "", amount: "-5", kind: "service" }] });
    ok("ред без име или с отрицателна сума се отказва", Boolean(badLine));
    const { error: asOtherOffer } = await other.c.from("offers").insert({ craftsman_id: craft.id, title: "Чужда", lines });
    ok("друг майстор не прави оферти от мое име", Boolean(asOtherOffer));
    const { data: seenByOther } = await other.c.from("offers").select("id").eq("id", offer!.id);
    ok("чужд майстор не вижда моите оферти", (seenByOther?.length ?? 0) === 0);
    const { data: anonDirect } = await anon.from("offers").select("id");
    ok("анонимен не чете таблицата с оферти", !anonDirect || anonDirect.length === 0);

    const { data: pub } = await anon.rpc("offer_by_token", { p_token: offer!.token });
    ok("клиентът вижда офертата по линка без вход", pub?.[0]?.title === "Оферта: баня" && pub[0].status === "sent", pub);
    ok("публичната оферта не издава идентификатор на майстора", !JSON.stringify(pub).includes(craft.id));
    const { error: noName } = await anon.rpc("respond_offer", { p_token: offer!.token, p_accept: true });
    ok("приемане изисква име", Boolean(noName));
    const { error: acceptErr } = await anon.rpc("respond_offer", { p_token: offer!.token, p_accept: true, p_name: "Иван Клиент" });
    ok("клиентът приема офертата с един клик", !acceptErr, acceptErr);
    const { data: accepted } = await craft.c.from("offers").select("status, job_id").eq("id", offer!.id).single();
    ok("приетата оферта е отбелязана и пази поръчка", accepted?.status === "accepted" && Boolean(accepted.job_id), accepted);
    const { error: twice } = await anon.rpc("respond_offer", { p_token: offer!.token, p_accept: false });
    ok("на оферта се отговаря само веднъж", Boolean(twice));
    const { data: offerNotif } = await craft.c.from("notifications").select("id").eq("kind", "system").like("title", "Офертата е приета%");
    ok("майсторът получава известие за приета оферта", (offerNotif?.length ?? 0) >= 1);

    // client notebook
    const { data: cl, error: clErr } = await craft.c.from("craftsman_clients").insert({ craftsman_id: craft.id, name: "Петър", yearly_check: true }).select("id, status").single();
    ok("клиентът започва като нова заявка", !clErr && cl?.status === "new", clErr);
    const { error: noteErr } = await craft.c.from("client_notes").insert({ client_id: cl!.id, craftsman_id: craft.id, body: "Домофон 12" });
    ok("Pro записва бележка към клиент", !noteErr, noteErr);
    const { error: foreignNote } = await other.c.from("client_notes").insert({ client_id: cl!.id, craftsman_id: other.id, body: "чужда" });
    ok("чужд майстор не пише бележки към моя клиент", Boolean(foreignNote));
    const { data: foreignRead } = await other.c.from("client_notes").select("id");
    ok("чужд майстор не чете моите бележки", (foreignRead?.length ?? 0) === 0);
    await craft.c.from("jobs").insert({ craftsman_id: craft.id, client_id: cl!.id, title: "Бойлер", start_date: "2030-03-01", end_date: "2030-03-01", status: "done" });
    const { data: clAfter } = await craft.c.from("craftsman_clients").select("status, remind_at, remind_note").eq("id", cl!.id).single();
    ok("свършена работа слага годишно напомняне след година", clAfter?.status === "done" && clAfter.remind_at === "2031-03-01" && clAfter.remind_note === "Годишен преглед", clAfter);

    // quick replies
    const { error: qrErr } = await craft.c.from("quick_replies").insert({ craftsman_id: craft.id, body: "Идвам след работа" });
    ok("майсторът запазва свой бърз отговор", !qrErr, qrErr);
    const { data: qrOther } = await other.c.from("quick_replies").select("id");
    ok("чужд майстор не вижда моите бързи отговори", (qrOther?.length ?? 0) === 0);
    const { error: qrAnon } = await anon.from("quick_replies").insert({ craftsman_id: craft.id, body: "x" });
    ok("анонимен не пише бързи отговори", Boolean(qrAnon));

    // photos on a client card
    const { error: phErr } = await craft.c.from("client_photos").insert({ client_id: cl!.id, craftsman_id: craft.id, path: `${craft.id}/${cl!.id}/test.jpg` });
    ok("Pro добавя снимка към клиент", !phErr, phErr);
    const { data: phOther } = await other.c.from("client_photos").select("id");
    ok("чужд майстор не вижда снимките към моите клиенти", (phOther?.length ?? 0) === 0);
    const { error: phForeign } = await other.c.from("client_photos").insert({ client_id: cl!.id, craftsman_id: other.id, path: `${other.id}/${cl!.id}/x.jpg` });
    ok("чужд майстор не добавя снимка към мой клиент", Boolean(phForeign));
    const { data: phAnon } = await anon.from("client_photos").select("id");
    ok("анонимен не чете снимките към клиенти", !phAnon || phAnon.length === 0);

    // Pro boost and the partner mark in search
    const { data: proRow } = await anon.rpc("search_craftsmen", { p_ids: [craft.id] });
    ok("Pro профилът е отбелязан като партньор в търсенето", proRow?.[0]?.is_pro === true, proRow);

    // price hints are Pro only and need enough data (the fixtures have fewer than 5 prices)
    const { data: hint } = await craft.c.rpc("category_price_hint", { p_category: 1 });
    ok("ценови подсказки не се показват при малко данни", Array.isArray(hint) && hint.length === 0);

    await boss.c.rpc("admin_set_plan", { p_craftsman: craft.id, p_plan: "free" });
    const { data: freeRow } = await anon.rpc("search_craftsmen", { p_ids: [craft.id] });
    ok("безплатният профил няма значка партньор", freeRow?.[0]?.is_pro === false, freeRow);
    const { error: freeNote } = await craft.c.from("client_notes").insert({ client_id: cl!.id, craftsman_id: craft.id, body: "нова" });
    ok("безплатен план не пише нови бележки към клиент", Boolean(freeNote));
    await admin.auth.admin.deleteUser(boss.id);
  }

  console.log("\nМодерация");
  {
    await admin.from("craftsman_profiles").update({ is_hidden: true }).eq("id", other.id);
    const { data: hidden } = await anon.from("craftsman_profiles").select("id").eq("id", other.id);
    ok("скрит майстор не се вижда публично", !hidden || hidden.length === 0);
    const { data: hiddenSearch } = await anon.rpc("search_craftsmen", { p_ids: [other.id] });
    ok("скрит майстор не излиза в търсенето", Array.isArray(hiddenSearch) && hiddenSearch.length === 0);
    await admin.from("profiles").update({ is_banned: true }).eq("id", bob.id);
    const { error: bannedStart } = await bob.c.rpc("start_conversation", { p_craftsman: craft.id, p_body: "здравейте" });
    ok("блокиран потребител не може да пише", Boolean(bannedStart));
    const { data: adminList, error: notAdmin } = await alice.c.rpc("admin_list_users", {});
    ok("клиент не може да вика admin_list_users", Boolean(notAdmin) && !adminList);
  }

  console.log("\n→ Почистване…");
  for (const u of [alice, bob, craft, other]) await admin.auth.admin.deleteUser(u.id);

  console.log(`\n${failed ? "✗" : "✓"} ${passed} успешни, ${failed} неуспешни`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});

export type { SupabaseClient };
