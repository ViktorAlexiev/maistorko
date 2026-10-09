import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { Avatar } from "@/components/avatar";
import { ReviewForm } from "@/components/review-form";

export const metadata: Metadata = { title: "Отзив", robots: { index: false } };

export default async function ReviewByLinkPage({ params }: PageProps<"/otzyv/[token]">) {
  const { token } = await params;
  const valid = /^[0-9a-f-]{36}$/.test(token);
  const supabase = await createClient();
  const info = valid ? (await supabase.rpc("review_invite_info", { p_token: token })).data?.[0] : null;
  const viewer = info ? await getViewer() : null;
  const next = `/otzyv/${token}`;

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      {!info ? (
        <>
          <h1 className="display text-5xl">Линкът не е валиден</h1>
          <p className="mt-3 text-lg text-ink-2">Помолете майстора да ви изпрати нов линк за отзив.</p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <Avatar name={info.craftsman_name} url={info.avatar_url} size={72} square />
            <div>
              <p className="text-sm font-bold text-ink-3">Отзив за</p>
              <h1 className="display text-4xl sm:text-5xl">{info.craftsman_name}</h1>
            </div>
          </div>

          {info.state === "used" && <p className="mt-6 rounded-[8px] bg-surface-2 px-4 py-3 font-semibold">Този линк вече е използван. Благодарим за отзива!</p>}
          {info.state === "expired" && <p className="mt-6 rounded-[8px] bg-surface-2 px-4 py-3 font-semibold">Линкът е изтекъл. Помолете майстора за нов.</p>}

          {info.state === "open" && (
            <div className="mt-6 grid gap-4">
              <p className="text-lg text-ink-2">Как мина работата? Отзивът ви помага на други хора да изберат майстор.</p>
              {viewer ? (
                <ReviewForm slug={info.craftsman_slug} token={token} />
              ) : (
                <div className="rounded-[10px] bg-ink p-5 text-white">
                  <p className="text-[#d8d4c8]">Влезте или се регистрирайте, за да оставите отзив. Отнема по-малко от минута.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/vhod?next=${encodeURIComponent(next)}`} className="btn btn-rule">
                      Вход
                    </Link>
                    <Link href={`/registratsia?next=${encodeURIComponent(next)}`} className="btn border border-white/40 text-white hover:bg-white/10">
                      Регистрация
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
          <p className="mt-8">
            <Link href={`/maistori/${info.craftsman_slug}`} className="link font-semibold">
              Към профила на {info.craftsman_name}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
