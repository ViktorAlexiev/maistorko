import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Спиране на писмата", robots: { index: false } };

export default async function UnsubscribePage({ params }: PageProps<"/otpiska/[token]">) {
  const { token } = await params;
  const valid = /^[0-9a-f-]{36}$/.test(token);
  let ok = false;
  if (valid) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("unsubscribe_emails", { p_token: token });
    ok = Boolean(data);
  }
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <h1 className="display text-5xl">{ok ? "Спряхме писмата" : "Линкът не е валиден"}</h1>
      <p className="mt-3 text-lg text-ink-2">
        {ok
          ? "Няма да получаваш писма от Майсторлъка. Известията в сайта продължават. Може да ги включиш пак от Профил."
          : "Този линк за спиране на писма не е верен или е стар."}
      </p>
      <Link href="/tabla/profil" className="btn btn-primary mt-6">
        Към профила
      </Link>
    </div>
  );
}
