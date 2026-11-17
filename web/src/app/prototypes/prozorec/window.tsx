"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, CheckCheck, Wrench, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import type { BookingData, Msg } from "../razgovor/data";
import { OfferReceipt } from "../razgovor/offer-cards";
import { useRoom, type Room } from "../razgovor/shared";
import { Thread } from "../razgovor/thread";
import { conversationMessages, CRAFTSMAN, FIRST_TOKEN, type SentData } from "./data";

/** The chat window of a craftsman's profile: bottom right on a desktop (25rem), full screen on a phone. */
export function ChatWindow({ open, line, onClose, children }: { open: boolean; line: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={`Чат с ${CRAFTSMAN.name}`}
      // Esc closes the window; a sheet inside it handles Esc first and stops it here
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className={`dock-in fixed z-50 flex-col overflow-hidden bg-surface shadow-[var(--shadow-lg)] max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-11 max-sm:rounded-t-[14px] sm:bottom-0 sm:right-6 sm:h-[min(38rem,calc(100dvh-5rem))] sm:w-[25rem] sm:rounded-t-[14px] ${open ? "flex" : "hidden"}`}
    >
      <header className="flex shrink-0 items-center gap-2.5 bg-surface py-2 pl-3.5 pr-1.5">
        <Avatar name={CRAFTSMAN.name} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.125rem] font-extrabold leading-tight">{CRAFTSMAN.name}</p>
          <p className="truncate text-sm leading-snug text-ink-2">{line}</p>
        </div>
        <button type="button" className="btn btn-ghost size-11 shrink-0 p-0" onClick={onClose} aria-label="Затвори чата" title="Затвори">
          <X className="size-5" aria-hidden />
        </button>
      </header>
      {children}
    </div>
  );
}

/** The first message inside the conversation: its date, work, photos and text together, with one time and one „Изпратено“. */
function FirstBubble({ sent }: { sent: SentData }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[14px] rounded-br-[4px] bg-ink px-3.5 py-2 text-white sm:max-w-[85%]">
        {(sent.label || sent.work) && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {sent.label && (
              <p className="inline-flex items-center gap-1.5 rounded-[6px] bg-rule px-2 py-1 text-sm font-bold text-ink">
                <CalendarDays className="size-4 shrink-0" aria-hidden />
                <span className="numerals text-base">{sent.label}</span>
              </p>
            )}
            {sent.work && (
              <p className="inline-flex items-center gap-1.5 rounded-[6px] bg-rule px-2 py-1 text-sm font-bold text-ink">
                <Wrench className="size-4 shrink-0" aria-hidden />
                {sent.work}
              </p>
            )}
          </div>
        )}
        {sent.photos.length > 0 && (
          <ul className="mb-1.5 grid max-w-full gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(sent.photos.length, 3)}, minmax(0, 5.75rem))` }}>
            {sent.photos.map((p, i) => (
              <li key={`${p.src}-${i}`} className="relative aspect-square overflow-hidden rounded-[6px] bg-surface-2">
                <a href={p.src} target="_blank" rel="noopener noreferrer" aria-label="Отвори снимката">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt="Снимка към съобщението" className="size-full object-cover" />
                </a>
                {p.demo && <span className="pointer-events-none absolute inset-x-0.5 bottom-0.5 rounded-[4px] bg-ink/85 px-1 py-0.5 text-center text-[0.625rem] font-bold leading-tight text-white">Демо изображение</span>}
              </li>
            ))}
          </ul>
        )}
        <p className="whitespace-pre-wrap break-words">{sent.body}</p>
        <p className="mt-0.5 flex items-center justify-end gap-1 text-[0.72rem] text-white/70">
          <span className="numerals text-[0.85rem]">{sent.time}</span>
          <CheckCheck className="size-3.5" aria-label="Изпратено" />
        </p>
      </div>
    </div>
  );
}

const nowTime = () => new Date().toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });

/**
 * The window's own conversation: the approved „Тихо“ thread, but with this craftsman, this first message and the client's side only.
 * The shared room of the conversation prototype fills in everything the window does not change.
 */
function useWindowRoom(box: React.RefObject<HTMLTextAreaElement | null>, sent: SentData, extended: boolean): Room {
  const base = useRoom(3, box);
  const [messages, setMessages] = useState<Msg[]>(() => conversationMessages(sent, extended));
  const [text, setText] = useState("");
  const seq = useRef(0);

  const patch = (fn: (xs: Msg[]) => Msg[]) => setMessages(fn);
  const settle = (id: string) => setTimeout(() => patch((xs) => xs.map((x) => (x.t === "text" && x.id === id ? { ...x, state: "sent" } : x))), 600);
  const bookings = messages.flatMap((m) => (m.t === "booking" ? [{ id: m.id, b: m.b }] : []));
  const upcoming = bookings.filter((x) => x.b.status === "confirmed" && !x.b.past)[0] ?? null;

  return {
    ...base,
    partner: { name: CRAFTSMAN.name, first: CRAFTSMAN.first, phone: CRAFTSMAN.phone },
    about: CRAFTSMAN.category,
    messages,
    upcoming,
    text,
    setText,
    showAsk: false,
    showRate: false,
    showRateForm: false,
    invited: false,
    submit: () => {
      const body = text.trim();
      if (!body) return;
      const id = `n${++seq.current}`;
      setText("");
      patch((xs) => [...xs, { t: "text", id, from: "client", body, time: nowTime(), state: "sending" }]);
      settle(id);
      box.current?.focus();
    },
    retry: (id: string) => {
      patch((xs) => xs.map((x) => (x.t === "text" && x.id === id ? { ...x, state: "sending" } : x)));
      settle(id);
    },
    actBooking: (id: string, action: "confirm" | "decline" | "cancel") => {
      base.setCancelAsk(null);
      const status = action === "confirm" ? "confirmed" : action === "decline" ? "declined" : "cancelled";
      patch((xs) => xs.map((x) => (x.t === "booking" && x.id === id ? { ...x, b: { ...x.b, status } as BookingData } : x)));
    },
  };
}

/** The conversation view of the window (s=3 and s=4): „Тихо“ in 25rem. */
export function Conversation({ sent, extended }: { sent: SentData; extended: boolean }) {
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const r = useWindowRoom(box, sent, extended);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [r.messages.length]);
  return (
    <Thread
      r={r}
      scroller={scroller}
      box={box}
      bare
      className="flex-1"
      offer={(o, bg) => (o.token === FIRST_TOKEN ? <FirstBubble sent={sent} /> : <OfferReceipt r={r} o={o} bg={bg} />)}
    />
  );
}
