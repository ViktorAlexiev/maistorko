/**
 * Background worker: sends queued e-mails and runs the maintenance jobs.
 *
 *   npm run worker        loops forever (every minute)
 *   npm run worker:once   one pass, then exits (handy for tests and cron)
 *
 * It needs the service role key, like the seed script, so it runs as a server-side process of its own:
 * never inside the web app and never in the browser. In production run it as a separate process,
 * a scheduled job, or move the same steps into Supabase scheduled functions.
 *
 * Environment (web/.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SITE_URL    public address used in e-mail links     (default http://localhost:3000)
 *   SMTP_URL    e.g. smtp://127.0.0.1:54325 (Mailpit)   (default that)
 *   MAIL_FROM   sender                                  (default "Майсторлъка <no-reply@maistorko.test>")
 */
import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Липсват NEXT_PUBLIC_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY в .env.local");
  process.exit(1);
}
const SITE_URL = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const MAIL_FROM = process.env.MAIL_FROM ?? "Майсторлъка <no-reply@maistorko.test>";
const db = createClient(url, key, { auth: { persistSession: false } });
const mail = nodemailer.createTransport(process.env.SMTP_URL ?? "smtp://127.0.0.1:54325");

const once = process.argv.includes("--once");
const MAX_ATTEMPTS = 5;

type Outbox = {
  id: number;
  notification_id: number | null;
  to_email: string;
  subject: string;
  body: string;
  link: string | null;
  unsub_token: string | null;
  attempts: number;
};

function render(m: Outbox) {
  const lines = [m.body];
  if (m.link) lines.push("", `Отвори: ${SITE_URL}${m.link}`);
  lines.push("", "—", "Майсторлъка");
  if (m.unsub_token) lines.push(`Не искаш такива писма? Спри ги: ${SITE_URL}/otpiska/${m.unsub_token}`);
  return lines.join("\n");
}

/** Sends every due e-mail. A notification already read in the app is not mailed. */
export async function sendDueEmails() {
  const { data, error } = await db
    .from("email_outbox")
    .select("id, notification_id, to_email, subject, body, link, unsub_token, attempts")
    .is("sent_at", null)
    .lte("send_after", new Date().toISOString())
    .lt("attempts", MAX_ATTEMPTS)
    .order("send_after")
    .limit(50);
  if (error) {
    console.error("outbox:", error.message);
    return { sent: 0, skipped: 0, failed: 0 };
  }
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const m of (data ?? []) as Outbox[]) {
    if (m.notification_id) {
      const { data: n } = await db.from("notifications").select("read_at").eq("id", m.notification_id).maybeSingle();
      if (n?.read_at) {
        await db.from("email_outbox").update({ sent_at: new Date().toISOString(), error: "прочетено в сайта" }).eq("id", m.id);
        skipped++;
        continue;
      }
    }
    try {
      await mail.sendMail({
        from: MAIL_FROM,
        to: m.to_email,
        subject: m.subject,
        text: render(m),
        headers: m.unsub_token ? { "List-Unsubscribe": `<${SITE_URL}/otpiska/${m.unsub_token}>` } : undefined,
      });
      await db.from("email_outbox").update({ sent_at: new Date().toISOString(), error: null }).eq("id", m.id);
      sent++;
    } catch (e) {
      await db
        .from("email_outbox")
        .update({ attempts: m.attempts + 1, error: e instanceof Error ? e.message.slice(0, 300) : "грешка" })
        .eq("id", m.id);
      failed++;
    }
  }
  return { sent, skipped, failed };
}

/** Deletes the photo files of conversations whose messages were purged (files cannot be removed with SQL). */
export async function purgeChatPhotos() {
  const { data: queue } = await db.from("chat_photo_purge_queue").select("conversation_id").limit(20);
  let removed = 0;
  for (const q of queue ?? []) {
    for (let round = 0; round < 50; round++) {
      const { data: files, error } = await db.storage.from("chat-photos").list(q.conversation_id, { limit: 100 });
      if (error) break; // stays queued, tried again next minute
      if (!files?.length) {
        await db.from("chat_photo_purge_queue").delete().eq("conversation_id", q.conversation_id);
        break;
      }
      const { error: rmErr } = await db.storage.from("chat-photos").remove(files.map((f) => `${q.conversation_id}/${f.name}`));
      if (rmErr) break;
      removed += files.length;
    }
  }
  return removed;
}

let lastDaily = "";
let lastWeekly = "";

/** Nightly cleanup (after 03:00 Sofia time) and the Sunday calendar reminder (after 17:00). */
export async function runMaintenance(now = new Date()) {
  const sofia = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Sofia" }));
  const day = sofia.toLocaleDateString("en-CA");
  const done: string[] = [];

  if (sofia.getHours() >= 3 && lastDaily !== day) {
    const { data, error } = await db.rpc("cleanup_old_chats", { p_days: 60 });
    if (error) console.error("cleanup:", error.message);
    else {
      lastDaily = day;
      done.push(`изчистени разговори: ${data}`);
    }
  }
  if (sofia.getDay() === 0 && sofia.getHours() >= 17 && lastWeekly !== day) {
    const { data, error } = await db.rpc("queue_calendar_reminders");
    if (error) console.error("reminders:", error.message);
    else {
      lastWeekly = day;
      done.push(`напомняния за календара: ${data}`);
    }
  }
  return done;
}

async function tick() {
  const mails = await sendDueEmails();
  const maintenance = await runMaintenance();
  const photos = await purgeChatPhotos();
  if (photos) maintenance.push(`изтрити снимки от чата: ${photos}`);
  const parts = [
    mails.sent || mails.skipped || mails.failed ? `писма: изпратени ${mails.sent}, пропуснати ${mails.skipped}, грешки ${mails.failed}` : "",
    ...maintenance,
  ].filter(Boolean);
  if (parts.length) console.log(`[${new Date().toLocaleTimeString("bg-BG")}] ${parts.join("; ")}`);
}

if (process.argv[1]?.endsWith("worker.ts")) {
  if (once) {
    tick().then(() => process.exit(0));
  } else {
    console.log(`Работникът е пуснат. Писма през ${process.env.SMTP_URL ?? "smtp://127.0.0.1:54325"}, линкове към ${SITE_URL}. Спиране: Ctrl+C`);
    tick();
    setInterval(tick, 60_000);
  }
}
