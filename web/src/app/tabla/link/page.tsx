import type { Metadata } from "next";
import QRCode from "qrcode";
import { Download, MessageCircle, Send, Share2 } from "lucide-react";
import { requireCraftsman } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import { addDaysISO, todayISO } from "@/lib/format";
import { CopyLink } from "./copy-link";

export const metadata: Metadata = { title: "Моят линк", robots: { index: false } };

export default async function MyLinkPage() {
  const viewer = await requireCraftsman();
  const supabase = await createClient();
  const origin = await siteOrigin();
  const url = `${origin}/m/${viewer.craftsmanSlug}`;
  const qr = await QRCode.toString(`${url}?s=qr`, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  const today = todayISO();
  const { data: visits } = await supabase
    .from("link_visits")
    .select("day, source, visits")
    .eq("craftsman_id", viewer.id)
    .gte("day", addDaysISO(today, -29));
  const sum = (rows: typeof visits, source?: string, from?: string) =>
    (rows ?? [])
      .filter((r) => (!source || r.source === source) && (!from || r.day >= from))
      .reduce((n, r) => n + r.visits, 0);
  const total30 = sum(visits);
  const total7 = sum(visits, undefined, addDaysISO(today, -6));

  const text = encodeURIComponent(`Виж кога съм свободен и ми пиши: ${url}`);
  const share = [
    { label: "Viber", href: `viber://forward?text=${text}`, icon: MessageCircle },
    { label: "WhatsApp", href: `https://wa.me/?text=${text}`, icon: Send },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, icon: Share2 },
  ];

  return (
    <div className="grid max-w-3xl gap-10">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Моят линк</h1>
        <p className="mt-2 max-w-2xl text-lg text-ink-2">
          Дай този линк или QR код на познати и клиенти. Който го отвори, вижда календара, цените и ти пише директно,
          дори да те е намерил извън сайта.
        </p>
      </div>

      <section aria-labelledby="link-heading" className="grid gap-3">
        <h2 id="link-heading" className="text-xl font-extrabold">
          Личен линк
        </h2>
        <CopyLink url={url} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">Сподели:</span>
          {share.map(({ label, href, icon: Icon }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
              <Icon className="size-4" aria-hidden /> {label}
            </a>
          ))}
        </div>
      </section>

      <section aria-labelledby="qr-heading" className="grid gap-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-start">
        <div
          role="img"
          aria-label="QR код към твоя профил"
          className="w-56 max-w-full rounded-[10px] border-[1.5px] border-ink bg-white p-3 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
          dangerouslySetInnerHTML={{ __html: qr }}
        />
        <div className="grid gap-3">
          <div>
            <h2 id="qr-heading" className="text-xl font-extrabold">
              QR код
            </h2>
            <p className="mt-1 text-ink-2">
              Сложи го на визитка, на буса, на стикер или в Facebook страницата си. Телефонът го отваря с един поглед на
              камерата.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/tabla/link/qr?fmt=png&size=1024" className="btn btn-primary" download>
              <Download className="size-4" aria-hidden /> PNG за печат
            </a>
            <a href="/tabla/link/qr?fmt=png&size=512" className="btn btn-outline" download>
              Малък PNG
            </a>
            <a href="/tabla/link/qr?fmt=svg" className="btn btn-outline" download>
              SVG
            </a>
          </div>
          <p className="text-sm text-ink-3">
            PNG 1024 е достатъчен за визитка и стикер. SVG е векторен: за голям печат, като бус или банер.
          </p>
        </div>
      </section>

      <section aria-labelledby="visits-heading" className="grid gap-3">
        <h2 id="visits-heading" className="text-xl font-extrabold">
          Посещения през линка
        </h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          {[
            ["Последните 7 дни", total7],
            ["Последните 30 дни", total30],
            ["От QR код (30 дни)", sum(visits, "qr")],
          ].map(([label, n]) => (
            <div key={label as string} className="rounded-[10px] border border-line bg-surface p-4">
              <dt className="text-sm text-ink-3">{label}</dt>
              <dd className="numerals mt-1 text-4xl leading-none">{n}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-ink-3">
          Броим само отваряния на линка. Не пазим данни за посетителите.
        </p>
      </section>
    </div>
  );
}
