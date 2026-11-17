"use client";

import { BadgeEuro, ChevronRight } from "lucide-react";
import { formatEur, pluralBg } from "@/lib/format";
import type { OfferData } from "./data";
import { Rivet, type Room } from "./shared";

/* Three designs of the offer inside the conversation. All use the real statuses of an offer (sent, accepted, declined, expired),
   the real link /oferta/<token> and the real action words of the page a client opens. */

const STATUS = {
  sent: { word: "Чака отговор", rivet: "ring" },
  accepted: { word: "Приета", rivet: "filled" },
  declined: { word: "Отказана", rivet: null },
  expired: { word: "Изтекла", rivet: null },
} as const;

function actionWord(r: Room) {
  return r.viewer === "client" ? "Виж и приеми офертата" : "Виж как я вижда клиентът";
}

/** „Видяна от Мария · валидна до 5 декември“; the client does not need to be told that he saw it. */
function detailLine(r: Room, o: OfferData) {
  const parts: string[] = [];
  if (r.viewer === "craftsman") parts.push(o.viewed ? `Видяна от ${r.partner.first}` : "Още не е видяна");
  if (o.status === "sent") parts.push(`валидна до ${o.validUntil}`);
  const line = parts.join(" · ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}

function StatusMark({ o, className = "" }: { o: OfferData; className?: string }) {
  const st = STATUS[o.status];
  return (
    <span className={`flex shrink-0 items-center gap-1.5 text-sm font-bold ${className}`}>
      {st.rivet && <Rivet kind={st.rivet} />}
      {st.word}
    </span>
  );
}

/** „Бележка“: a receipt with the lines, a total row one tone back and a status line. */
export function OfferReceipt({ r, o, bg }: { r: Room; o: OfferData; bg: string }) {
  return (
    <div className={`mx-auto my-1.5 w-full max-w-md rounded-[10px] p-3.5 ${bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-ink-2">
            <BadgeEuro className="size-4" aria-hidden /> Оферта
          </p>
          <p className="mt-0.5 font-bold leading-snug">{o.title}</p>
        </div>
        <StatusMark o={o} className="pt-0.5" />
      </div>
      <ul className="mt-2 grid gap-0.5">
        {o.lines.map((l) => (
          <li key={l.name} className="flex items-baseline justify-between gap-4 py-1">
            <span className="min-w-0">{l.name}</span>
            <span className="numerals shrink-0 text-xl">{formatEur(l.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex items-baseline justify-between gap-4 rounded-[6px] bg-surface-2 px-3 py-2 font-extrabold">
        <span>Общо</span>
        <span className="numerals text-3xl">{formatEur(o.total)}</span>
      </p>
      <p className="mt-2 text-sm text-ink-2">{detailLine(r, o)}</p>
      <a href={`/oferta/${o.token}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline mt-2 w-full">
        {actionWord(r)}
      </a>
    </div>
  );
}

/** „Цена на жълто“: the total on a Rule Yellow block, the facts beside it; the whole card is one link. */
export function OfferYellow({ r, o, bg }: { r: Room; o: OfferData; bg: string }) {
  const until = o.validUntil.replace(/\S+$/, (m) => m.slice(0, 3));
  return (
    <a href={`/oferta/${o.token}`} target="_blank" rel="noopener noreferrer" className={`mx-auto my-1.5 flex w-full max-w-md overflow-hidden rounded-[10px] ${bg}`}>
      <span className="grid shrink-0 place-items-center bg-rule px-4 py-3">
        <span className="numerals text-[2.4rem] leading-none">{formatEur(o.total)}</span>
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-2 py-2.5 pl-3 pr-2">
        <span className="min-w-0 flex-1">
          <span className="block font-bold leading-snug">{o.title}</span>
          <span className="block text-sm text-ink-2">
            {pluralBg(o.lines.length, "позиция", "позиции")}
            {o.status === "sent" ? ` · валидна до ${until}` : ""}
          </span>
          <StatusMark o={o} className="mt-0.5" />
          <span className="sr-only">{actionWord(r)}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-ink-2" aria-hidden />
      </span>
    </a>
  );
}

/** „Ред“: one strip like a row of a list; the whole strip opens the offer. */
export function OfferRow({ r, o, bg }: { r: Room; o: OfferData; bg: string }) {
  const st = STATUS[o.status];
  return (
    <a href={`/oferta/${o.token}`} target="_blank" rel="noopener noreferrer" className={`mx-auto my-1 flex min-h-11 w-full max-w-md items-center gap-3 rounded-[6px] px-3 py-2.5 ${bg}`}>
      <BadgeEuro className="size-6 shrink-0" strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block font-bold leading-snug">{o.title}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-2">
          {st.rivet && <Rivet kind={st.rivet} />}
          {st.word}
        </span>
        <span className="sr-only">{actionWord(r)}</span>
      </span>
      <span className="numerals shrink-0 text-2xl">{formatEur(o.total)}</span>
    </a>
  );
}
