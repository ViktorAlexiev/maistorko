import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/avatar";
import { formatDate, formatEur } from "@/lib/format";
import { OfferResponse } from "./offer-response";

export const metadata: Metadata = { title: "Оферта", robots: { index: false, follow: false } };

type Line = { name: string; amount: string; kind: "service" | "material" };

export default async function OfferPage({ params }: PageProps<"/oferta/[token]">) {
  const { token } = await params;
  const valid = /^[0-9a-f-]{36}$/.test(token);
  const supabase = await createClient();
  const o = valid ? (await supabase.rpc("offer_by_token", { p_token: token })).data?.[0] : null;

  if (!o) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <h1 className="display text-5xl">Офертата не е намерена</h1>
        <p className="mt-3 text-lg text-ink-2">Линкът е грешен или офертата е изтрита. Помолете майстора да ви прати нов.</p>
      </div>
    );
  }

  const lines = (o.lines as Line[]) ?? [];
  const work = lines.filter((l) => l.kind === "service");
  const materials = lines.filter((l) => l.kind === "material");
  const Group = ({ title, items }: { title: string; items: Line[] }) =>
    items.length === 0 ? null : (
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-3">{title}</h2>
        <ul className="mt-1 grid border-t border-line">
          {items.map((l, i) => (
            <li key={i} className="flex items-baseline justify-between gap-4 border-b border-line py-2">
              <span>{l.name}</span>
              <span className="numerals text-xl">{formatEur(Number(l.amount))}</span>
            </li>
          ))}
        </ul>
      </div>
    );

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-4">
        <Avatar name={o.craftsman_name} url={o.avatar_url} size={64} square />
        <div>
          <p className="text-sm font-bold text-ink-3">Оферта от</p>
          <p className="display text-3xl">{o.craftsman_name}</p>
        </div>
      </div>

      <h1 className="display mt-8 text-4xl sm:text-5xl">{o.title}</h1>
      {o.client_name && <p className="mt-1 text-ink-2">За: {o.client_name}</p>}

      <div className="mt-6 grid gap-5">
        <Group title="Труд" items={work} />
        <Group title="Материали" items={materials} />
        <p className="flex items-baseline justify-between gap-4 text-lg font-extrabold">
          <span>Общо</span>
          <span className="numerals text-4xl">{formatEur(Number(o.total))}</span>
        </p>
        {o.start_date && (
          <p className="rounded-[8px] bg-surface-2 px-4 py-3 font-semibold">
            Срок: {formatDate(o.start_date, true)}
            {o.end_date && o.end_date !== o.start_date ? ` – ${formatDate(o.end_date, true)}` : ""}
          </p>
        )}
        {o.note && <p className="whitespace-pre-wrap text-ink-2">{o.note}</p>}
      </div>

      <div className="mt-8">
        {o.status === "sent" ? (
          <OfferResponse token={token} validUntil={formatDate(o.valid_until.slice(0, 10))} />
        ) : o.status === "accepted" ? (
          <p className="rounded-[8px] bg-free-soft px-4 py-3 font-semibold text-free">
            Офертата е приета{o.accepted_by ? ` от ${o.accepted_by}` : ""}. Майсторът ще се свърже с вас.
          </p>
        ) : o.status === "declined" ? (
          <p className="rounded-[8px] bg-surface-2 px-4 py-3 font-semibold">Офертата е отказана.</p>
        ) : (
          <p className="rounded-[8px] bg-surface-2 px-4 py-3 font-semibold">Офертата е изтекла. Помолете майстора за нова.</p>
        )}
      </div>

      <p className="mt-8 text-sm text-ink-3">
        Това е споделена цена и срок между вас и майстора, не е фактура.{" "}
        <Link href={`/maistori/${o.craftsman_slug}`} className="link font-semibold">
          Профил на {o.craftsman_name}
        </Link>
      </p>
    </div>
  );
}
