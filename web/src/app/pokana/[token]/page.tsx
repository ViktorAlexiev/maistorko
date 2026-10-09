import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { getMyOrg } from "@/lib/org";
import { AcceptInvite } from "./accept";

export const metadata: Metadata = { title: "Покана от фирма", robots: { index: false } };

const ROLE_TEXT = { owner: "собственик", manager: "мениджър", craftsman: "майстор" } as const;

export default async function InvitePage({ params }: PageProps<"/pokana/[token]">) {
  const { token } = await params;
  const valid = /^[0-9a-f-]{36}$/.test(token);
  const supabase = await createClient();
  const info = valid ? (await supabase.rpc("org_invite_info", { p_token: token })).data?.[0] : null;
  const viewer = info ? await getViewer() : null;
  const myOrg = viewer ? await getMyOrg() : null;
  const next = `/pokana/${token}`;

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      {!info ? (
        <>
          <h1 className="display text-5xl">Поканата не е валидна</h1>
          <p className="mt-3 text-lg text-ink-2">Помолете фирмата да ви изпрати нова покана.</p>
        </>
      ) : (
        <>
          <p className="text-sm font-bold text-ink-3">Покана от фирма</p>
          <h1 className="display text-5xl sm:text-6xl">{info.org_name}</h1>
          <p className="mt-3 text-lg text-ink-2">
            Поканени сте като <strong className="text-ink">{ROLE_TEXT[info.role as keyof typeof ROLE_TEXT]}</strong>
            {info.full_name ? ` (${info.full_name})` : ""}.
            {info.role === "craftsman" && " След като приемете, ще имате свой профил, календар и чат с клиентите. Отзивите и снимките остават ваши."}
          </p>

          {info.state === "used" && <p className="mt-6 rounded-[8px] bg-surface-2 px-4 py-3 font-semibold">Тази покана вече е използвана.</p>}
          {info.state === "expired" && <p className="mt-6 rounded-[8px] bg-surface-2 px-4 py-3 font-semibold">Поканата е изтекла. Помолете за нова.</p>}

          {info.state === "open" &&
            (viewer ? (
              myOrg ? (
                <p className="mt-6 rounded-[8px] bg-rule-soft px-4 py-3 font-semibold">
                  Вече сте във фирма „{myOrg.name}“. За да приемете друга покана, първо напуснете от{" "}
                  <Link href="/tabla/firma" className="link">
                    Фирма
                  </Link>
                  .
                </p>
              ) : (
                <AcceptInvite token={token} role={info.role as "owner" | "manager" | "craftsman"} orgSlug={info.org_slug} />
              )
            ) : (
              <div className="mt-6 rounded-[10px] bg-ink p-5 text-white">
                <p className="text-[#d8d4c8]">Създайте профил или влезте, за да приемете. Отнема по-малко от минута.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/registratsia?next=${encodeURIComponent(next)}`} className="btn btn-rule">
                    Регистрация
                  </Link>
                  <Link href={`/vhod?next=${encodeURIComponent(next)}`} className="btn border border-white/40 text-white hover:bg-white/10">
                    Вече имам профил
                  </Link>
                </div>
              </div>
            ))}
        </>
      )}
    </div>
  );
}
