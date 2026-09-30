"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarCheck, CalendarDays, CalendarPlus, Check, CheckCheck, Phone, RotateCw, SendHorizontal, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { formatDate, formatTime, relativeDay, servicePrice, todayISO, type PriceKind, type PriceUnit } from "@/lib/format";
import { slotLabel } from "@/lib/slots";
import { BookingCard, BookingSheet, bookingWhen, KIND_LABEL, type Booking } from "./booking";

export type ChatMessage = {
  id: number;
  sender_id: string;
  body: string;
  meta: {
    date?: string;
    category?: string;
    slot?: string;
    booking_id?: string;
    event?: string;
    service?: string;
    price_kind?: PriceKind;
    price?: number | null;
    unit?: PriceUnit;
  } | null;
  created_at: string;
  pending?: boolean;
  failed?: boolean;
  tempId?: string;
};

type Props = {
  conversationId: string;
  me: string;
  iAmClient: boolean;
  partner: { id: string; name: string; avatar: string | null; slug: string | null; phone: string | null };
  requestedDate: string | null;
  categoryName: string | null;
  initial: ChatMessage[];
  initialBookings: Booking[];
  craftsmanId: string;
  banned: boolean;
  /** Inside the chat window on a profile: the window draws its own header. */
  embedded?: boolean;
  /** Text to put in the composer, e.g. a question about the day picked on the profile. */
  draft?: string;
};

let tempSeq = 0;
const sofiaDay = (ts: string) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "Europe/Sofia" });

export function Thread({ conversationId, me, iAmClient, partner, requestedDate, categoryName, initial, initialBookings, craftsmanId, banned, embedded, draft }: Props) {
  const supabase = createClient();
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState(draft ?? "");
  const [prevDraft, setPrevDraft] = useState(draft);
  if (draft !== prevDraft) {
    setPrevDraft(draft);
    if (draft) setText(draft);
  }
  const [live, setLive] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [sheet, setSheet] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const atBottom = useRef(true);

  const markRead = useCallback(async () => {
    await supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
    window.dispatchEvent(new Event("maistorko:read"));
  }, [supabase, conversationId]);

  // Several events can trigger a refresh at once; only the newest response wins.
  const bookingSeq = useRef(0);
  const refreshBookings = useCallback(async () => {
    const seq = ++bookingSeq.current;
    const { data } = await supabase
      .from("bookings")
      .select("id, booking_date, start_time, end_time, kind, status, note, proposed_by, craftsman_id, client_id")
      .eq("conversation_id", conversationId)
      .order("created_at");
    if (data && seq === bookingSeq.current) setBookings(data as Booking[]);
  }, [supabase, conversationId]);

  // Realtime: new messages and booking changes in this conversation (RLS-filtered on the server)
  useEffect(() => {
    markRead();
    const channel = supabase
      .channel(`thread-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const m = payload.new as ChatMessage;
          setMessages((xs) => {
            if (xs.some((x) => x.id === m.id)) return xs;
            // replace my optimistic copy if present
            const idx = xs.findIndex((x) => x.pending && x.sender_id === m.sender_id && x.body === m.body);
            if (idx >= 0) return xs.map((x, i) => (i === idx ? m : x));
            return [...xs, m];
          });
          if (m.sender_id !== me && document.visibilityState === "visible") markRead();
          if (m.meta?.booking_id) refreshBookings();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `conversation_id=eq.${conversationId}` },
        () => refreshBookings(),
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    const onVisible = () => document.visibilityState === "visible" && markRead();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [supabase, conversationId, me, markRead, refreshBookings]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(body: string, tempId = crypto.randomUUID()) {
    const optimistic: ChatMessage = {
      id: --tempSeq,
      tempId,
      sender_id: me,
      body,
      meta: {},
      created_at: new Date().toISOString(),
      pending: true,
    };
    atBottom.current = true;
    setMessages((xs) => [...xs.filter((x) => x.tempId !== tempId), optimistic]);
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: me, body })
      .select("id, sender_id, body, meta, created_at")
      .single();
    setMessages((xs) => {
      if (error || !data) return xs.map((x) => (x.tempId === tempId ? { ...x, pending: false, failed: true } : x));
      const withoutTemp = xs.filter((x) => x.tempId !== tempId);
      return withoutTemp.some((x) => x.id === data.id) ? withoutTemp : [...withoutTemp, data as ChatMessage];
    });
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if (!body || body.length > 4000) return;
    setText("");
    send(body);
    box.current?.focus();
  }

  const partnerReplied = messages.some((m) => m.sender_id === partner.id);
  const today = todayISO();
  const byId = new Map(bookings.map((b) => [b.id, b]));
  const firstMessageFor = new Map<string, number>();
  for (const m of messages) if (m.meta?.booking_id && !firstMessageFor.has(m.meta.booking_id)) firstMessageFor.set(m.meta.booking_id, m.id);
  const upcoming = bookings
    .filter((b) => b.status === "confirmed" && b.booking_date >= today)
    .sort((a, b) => (a.booking_date + (a.start_time ?? "")).localeCompare(b.booking_date + (b.start_time ?? "")))[0];

  return (
    <section aria-label={`Разговор с ${partner.name}`} className="flex min-h-0 flex-col bg-paper">
      {/* Header */}
      {!embedded && (
      <header className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2.5 sm:px-4">
        <Link href="/saobshtenia" className="btn btn-ghost btn-sm md:hidden" aria-label="Всички разговори">
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <Avatar name={partner.name} url={partner.avatar} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-extrabold">
            {partner.slug ? (
              <Link href={`/maistori/${partner.slug}`} className="hover:underline">
                {partner.name}
              </Link>
            ) : (
              partner.name
            )}
          </p>
          <p className="flex items-center gap-1.5 truncate text-sm text-ink-2">
            {requestedDate && (
              <>
                <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                {relativeDay(requestedDate)}
                {requestedDate < today && " (минала дата)"}
              </>
            )}
            {requestedDate && categoryName && " · "}
            {categoryName}
          </p>
        </div>
        {partner.phone && (
          <a href={`tel:${partner.phone.replace(/\s/g, "")}`} className="btn btn-outline btn-sm">
            <Phone className="size-4" aria-hidden /> <span className="hidden sm:inline">{partner.phone}</span>
            <span className="sm:hidden">Обади се</span>
          </a>
        )}
        <span
          className={`size-2 shrink-0 rounded-full ${live ? "bg-free" : "bg-line-strong"}`}
          title={live ? "Съобщенията пристигат веднага" : "Свързваме се…"}
          aria-label={live ? "Връзката е активна" : "Свързване"}
        />
      </header>
      )}
      {upcoming && (
        <p className="flex items-center gap-2 border-b border-free/30 bg-free-soft px-4 py-2 text-sm font-semibold text-free">
          <CalendarCheck className="size-4 shrink-0" aria-hidden />
          <span className="first-letter:uppercase">
            {KIND_LABEL[upcoming.kind]}: {bookingWhen(upcoming)}
          </span>
        </p>
      )}

      {/* Messages */}
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6"
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <ol className="mx-auto grid max-w-2xl gap-1.5">
          {messages.map((m, i) => {
            const mine = m.sender_id === me;
            const day = sofiaDay(m.created_at);
            const showDay = i === 0 || day !== sofiaDay(messages[i - 1].created_at);
            return (
              <li key={m.tempId ?? m.id} className="msg grid">
                {showDay && (
                  <p className="my-3 text-center text-xs font-bold uppercase tracking-wide text-ink-3">
                    {day === today ? "Днес" : relativeDay(day, today) === "утре" ? formatDate(day) : formatDate(day, true)}
                  </p>
                )}
                {m.meta?.booking_id ? (
                  firstMessageFor.get(m.meta.booking_id) === m.id && byId.get(m.meta.booking_id) ? (
                    <BookingCard booking={byId.get(m.meta.booking_id)!} me={me} partnerName={partner.name} onChanged={refreshBookings} />
                  ) : (
                    <p className="my-1 text-center text-sm text-ink-2">
                      <span className="font-semibold">{mine ? "Вие" : partner.name.split(" ")[0]}:</span> {m.body}
                      <span className="ml-1.5 text-xs text-ink-3">{formatTime(m.created_at)}</span>
                    </p>
                  )
                ) : (
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-[14px] px-3.5 py-2 sm:max-w-[75%] ${
                      mine ? "rounded-br-[4px] bg-ink text-white" : "rounded-bl-[4px] bg-surface ring-1 ring-inset ring-line"
                    } ${m.failed ? "opacity-70 ring-2 ring-danger" : ""}`}
                  >
                    {(m.meta?.date || m.meta?.service || m.meta?.category) && (
                      <p
                        className={`mb-1.5 inline-flex flex-wrap items-center gap-x-1.5 rounded-[6px] px-2 py-1 text-sm font-bold ${
                          mine ? "bg-rule text-ink" : "bg-rule-soft"
                        }`}
                      >
                        {m.meta.date && (
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="size-4 shrink-0" aria-hidden />
                            <span>
                              {formatDate(m.meta.date, true)}
                              {m.meta.slot && <span className="font-semibold">, {slotLabel(m.meta.slot)}</span>}
                            </span>
                          </span>
                        )}
                        {m.meta.date && (m.meta.service || m.meta.category) && <span aria-hidden>·</span>}
                        {m.meta.service ? (
                          <span className="font-semibold">
                            {m.meta.service}
                            {m.meta.price_kind && m.meta.unit && `, ${servicePrice(m.meta.price_kind, m.meta.price ?? null, m.meta.unit)}`}
                          </span>
                        ) : (
                          m.meta.category && <span className="font-semibold">{m.meta.category}</span>
                        )}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`mt-0.5 flex items-center justify-end gap-1 text-[0.72rem] ${mine ? "text-white/60" : "text-ink-3"}`}>
                      {formatTime(m.created_at)}
                      {mine &&
                        (m.pending ? (
                          <Check className="size-3.5" aria-label="Изпраща се" />
                        ) : m.failed ? null : (
                          <CheckCheck className="size-3.5" aria-label="Изпратено" />
                        ))}
                    </p>
                  </div>
                </div>
                )}
                {m.failed && (
                  <button
                    type="button"
                    onClick={() => send(m.body, m.tempId)}
                    className="mt-1 inline-flex items-center gap-1 justify-self-end text-sm font-bold text-danger"
                  >
                    <RotateCw className="size-3.5" aria-hidden /> Не е изпратено. Опитай пак
                  </button>
                )}
              </li>
            );
          })}
        </ol>
        {iAmClient && partnerReplied && partner.slug && (
          <div className="mx-auto mt-6 flex max-w-2xl items-center gap-3 rounded-[10px] border border-dashed border-line-strong p-3 text-sm">
            <Star className="size-5 shrink-0" aria-hidden />
            <p className="flex-1">Свърши ли работата? Отзивът ви помага на други клиенти.</p>
            <Link href={`/maistori/${partner.slug}#otzivi`} className="btn btn-outline btn-sm">
              Оцени
            </Link>
          </div>
        )}
      </div>

      {/* Composer */}
      {banned ? (
        <p className="border-t border-line bg-danger-soft p-4 text-center font-semibold text-danger">
          Профилът ви е блокиран и не можете да пишете.
        </p>
      ) : (
        <form onSubmit={submit} className="safe-bottom border-t border-line bg-surface px-3 pt-3 sm:px-4">
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <button
              type="button"
              className="btn btn-outline size-11 shrink-0 p-0 sm:w-auto sm:px-3"
              onClick={() => setSheet(true)}
              aria-label={iAmClient ? "Предложи час" : "Запази час"}
              title={iAmClient ? "Предложи ден и час за оглед или работа" : "Запази ден и час в календара си"}
            >
              <CalendarPlus className="size-5" aria-hidden />
              <span className="hidden sm:inline">Уговорка</span>
            </button>
            <label htmlFor="msg" className="sr-only">
              Съобщение
            </label>
            <textarea
              id="msg"
              ref={box}
              rows={1}
              maxLength={4000}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Напишете съобщение…"
              className="field max-h-40 min-h-11 resize-none py-2.5"
              enterKeyHint="send"
            />
            <button type="submit" className="btn btn-primary size-11 shrink-0 p-0" disabled={!text.trim()} aria-label="Изпрати">
              <SendHorizontal className="size-5" aria-hidden />
            </button>
          </div>
          <p className="mx-auto mt-1 hidden max-w-2xl text-xs text-ink-3 sm:block">
            Enter изпраща, Shift+Enter за нов ред. Когато се разберете за ден, натиснете „Уговорка“.
          </p>
        </form>
      )}
      {!banned && (
        <BookingSheet
          open={sheet}
          onClose={() => setSheet(false)}
          conversationId={conversationId}
          craftsmanId={craftsmanId}
          iAmCraftsman={!iAmClient}
          partnerName={partner.name}
          defaultDate={requestedDate}
          onCreated={refreshBookings}
        />
      )}
    </section>
  );
}
