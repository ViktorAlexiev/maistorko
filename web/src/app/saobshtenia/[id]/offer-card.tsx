"use client";

import { BadgeEuro } from "lucide-react";
import { formatDate, formatEur } from "@/lib/format";

/** A line of an offer, as the offer page reads it. */
export type Line = { name: string; amount: string; kind: "service" | "material" };

/** A row of the database function `chat_offers`: what the card needs, without marking the offer as seen. */
export type ChatOffer = { token: string; lines: Line[]; total: number; status: string; valid_until: string; viewed_at: string | null };

const STATUS: Record<string, { word: string; rivet: "filled" | "ring" | null }> = {
  sent: { word: "Чака отговор", rivet: "ring" },
  accepted: { word: "Приета", rivet: "filled" },
  declined: { word: "Отказана", rivet: null },
  expired: { word: "Изтекла", rivet: null },
};

/** A small round mark: filled for done, a ring for waiting. */
export function Rivet({ kind }: { kind: "filled" | "ring" }) {
  return <span aria-hidden className={`inline-block size-3 shrink-0 rounded-full ${kind === "ring" ? "ring-2 ring-inset ring-ink" : "bg-ink"}`} />;
}

const sofiaDay = (ts: string) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "Europe/Sofia" });

/** „Видяна от Мария · валидна до 5 декември“; the client does not need to be told that he saw it. */
function detailLine(o: ChatOffer, iAmClient: boolean, partnerFirst: string) {
  const parts: string[] = [];
  if (!iAmClient) parts.push(o.viewed_at ? `Видяна от ${partnerFirst}` : "Още не е видяна");
  if (o.status === "sent") parts.push(`валидна до ${formatDate(sofiaDay(o.valid_until))}`);
  const line = parts.join(" · ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}

function StatusMark({ status, className = "" }: { status: string; className?: string }) {
  const st = STATUS[status] ?? { word: status, rivet: null };
  return (
    <span className={`flex shrink-0 items-center gap-1.5 text-sm font-bold ${className}`}>
      {st.rivet && <Rivet kind={st.rivet} />}
      {st.word}
    </span>
  );
}

/** „Бележка“: a receipt with the lines, a total row one tone back and a status line. */
function OfferReceipt({ title, offer, iAmClient, partnerFirst, bg }: { title: string; offer: ChatOffer; iAmClient: boolean; partnerFirst: string; bg: string }) {
  const detail = detailLine(offer, iAmClient, partnerFirst);
  return (
    <div className={`mx-auto my-1.5 w-full max-w-md rounded-[10px] p-3.5 ${bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-bold text-ink-2">
            <BadgeEuro className="size-4" aria-hidden /> Оферта
          </p>
          <p className="mt-0.5 font-bold leading-snug">{title}</p>
        </div>
        <StatusMark status={offer.status} className="pt-0.5" />
      </div>
      <ul className="mt-2 grid gap-0.5">
        {offer.lines.map((l, i) => (
          <li key={i} className="flex items-baseline justify-between gap-4 py-1">
            <span className="min-w-0">{l.name}</span>
            <span className="numerals shrink-0 text-xl">{formatEur(l.amount)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex items-baseline justify-between gap-4 rounded-[6px] bg-surface-2 px-3 py-2 font-extrabold">
        <span>Общо</span>
        <span className="numerals text-3xl">{formatEur(offer.total)}</span>
      </p>
      {detail && <p className="mt-2 text-sm text-ink-2">{detail}</p>}
      <OfferLink token={offer.token} iAmClient={iAmClient} />
    </div>
  );
}

function OfferLink({ token, iAmClient }: { token: string; iAmClient: boolean }) {
  return (
    <a href={`/oferta/${token}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline mt-2 w-full">
      {iAmClient ? "Виж и приеми офертата" : "Виж как я вижда клиентът"}
    </a>
  );
}

/** The offer in the conversation. Without its row (the offer was deleted) it shows the title and the sum from the message. */
export function OfferCard({
  token,
  title,
  total,
  offer,
  iAmClient,
  partnerFirst,
  bg,
}: {
  token: string;
  title: string;
  total: number | null;
  offer: ChatOffer | undefined;
  iAmClient: boolean;
  partnerFirst: string;
  /** the card tone that fits the ground it lies on */
  bg: string;
}) {
  if (offer) return <OfferReceipt title={title} offer={offer} iAmClient={iAmClient} partnerFirst={partnerFirst} bg={bg} />;
  return (
    <div className={`mx-auto my-1.5 w-full max-w-md rounded-[10px] p-3.5 ${bg}`}>
      <p className="flex items-center gap-1.5 text-sm font-bold text-ink-2">
        <BadgeEuro className="size-4" aria-hidden /> Оферта
      </p>
      <p className="mt-0.5 font-bold">{title}</p>
      {total != null && <p className="numerals text-3xl">{total.toFixed(2).replace(".", ",")} €</p>}
      <OfferLink token={token} iAmClient={iAmClient} />
    </div>
  );
}
