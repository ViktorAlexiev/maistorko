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
    ok("уговорка от майстора се запазва веднага", !e3 && b2row?.status === "confirmed", e3 ?? b2row);
    const { error: e4 } = await alice.c.rpc("respond_booking", { p_booking: b1 as string, p_action: "cancel" });
    ok("клиентът може да отмени потвърдена уговорка", !e4, e4);
    ok("отменената уговорка освобождава часовете", (await freeAt()) === "08:00-13:00,16:00-17:00", await freeAt());
    const { data: bookingMsgs } = await alice.c.from("messages").select("meta").eq("conversation_id", convId as string);
    ok("всяко действие оставя съобщение в чата", (bookingMsgs ?? []).filter((m) => (m.meta as { booking_id?: string })?.booking_id).length === 4);
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
