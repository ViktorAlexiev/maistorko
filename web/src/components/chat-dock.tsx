"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { ExternalLink, Minus, X } from "lucide-react";
import { startConversation } from "@/app/actions/engage";
import type { FormState } from "@/app/actions/auth";
import { Thread, type ChatMessage } from "@/app/saobshtenia/[id]/thread";
import type { Booking } from "@/app/saobshtenia/[id]/booking";
import type { Share } from "@/app/saobshtenia/[id]/chat-photos";
import { Avatar } from "@/components/avatar";
import { FieldError, FormMessage, SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/client";
import { relativeDay } from "@/lib/format";
import { slotLabel, type Slot } from "@/lib/slots";
import { composeAnswers, questionsFor } from "@/lib/inquiry-questions";

export const OPEN_CHAT = "maistorko:open-chat";

/** Opens the chat window on a craftsman profile. */
export function OpenChatButton({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_CHAT))}>
      {children}
    </button>
  );
}

export type WorkOption = { value: string; label: string; priced: boolean };

type Craftsman = {
  id: string;
  name: string;
  firstName: string;
  avatar: string | null;
  slug: string;
  /** the craftsman's main kinds of work: the first message offers questions for them */
  categories?: { slug: string; name: string }[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  craftsman: Craftsman;
  me: string | null;
  isSelf: boolean;
  banned: boolean;
  conversationId: string | null;
  workOptions: WorkOption[];
  date: string | null;
  slot: Slot | null;
  onDate: (d: string | null) => void;
  today: string;
  busyDay: boolean;
  /** Set when "Пиши за …" was pressed: prefill the reply in an existing conversation. */
  ask: { date: string; slot: Slot | null } | null;
  onAskUsed: () => void;
};

/**
 * A chat window docked to the bottom right (full screen on phones). The first message is a short form
 * with date and type of work; after that it is the live conversation itself.
 */
export function ChatDock(props: Props) {
  const { open, onClose, craftsman, me, isSelf, conversationId } = props;
  const [minimized, setMinimized] = useState(false);
  const [started, setStarted] = useState<string | null>(null);
  const convId = started ?? conversationId;
  const root = useRef<HTMLDivElement>(null);

  // Reopening always shows the window expanded
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setMinimized(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector("dialog[open]") && onClose();
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => {
      const r = root.current;
      (r?.querySelector<HTMLElement>("textarea") ?? r?.querySelector<HTMLElement>("a:not([data-chrome]), button:not([data-chrome])"))?.focus();
    }, 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open, onClose, convId]);

  if (!open) return null;

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="false"
      aria-label={`Чат с ${craftsman.name}`}
      className={`dock-in fixed z-50 flex flex-col overflow-hidden border-line-strong bg-paper shadow-[var(--shadow-lg)] sm:bottom-0 sm:right-6 sm:w-[25rem] sm:rounded-t-[12px] sm:border sm:border-b-0 ${
        minimized ? "max-sm:inset-x-0 max-sm:bottom-0" : "max-sm:inset-0 sm:h-[min(38rem,calc(100dvh-5rem))]"
      }`}
    >
      <header className="flex shrink-0 items-center gap-2.5 bg-ink px-3 py-2 text-white">
        <button
          type="button"
          data-chrome
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          onClick={() => setMinimized((m) => !m)}
          aria-expanded={!minimized}
          aria-label={minimized ? "Разгъни чата" : "Свий чата"}
        >
          <Avatar name={craftsman.name} url={craftsman.avatar} size={34} />
          <span className="min-w-0">
            <span className="block truncate font-extrabold">{craftsman.name}</span>
            <span className="block truncate text-xs text-[#bdb8aa]">{convId ? "Разговор" : "Ново съобщение"}</span>
          </span>
        </button>
        {convId && (
          <Link
            href={`/saobshtenia/${convId}`}
            data-chrome
            className="grid size-9 place-items-center rounded-[8px] hover:bg-white/10"
            aria-label="Отвори в „Съобщения“"
            title="Отвори в „Съобщения“"
          >
            <ExternalLink className="size-4" aria-hidden />
          </Link>
        )}
        <button
          type="button"
          data-chrome
          className="hidden size-9 place-items-center rounded-[8px] hover:bg-white/10 sm:grid"
          onClick={() => setMinimized((m) => !m)}
          aria-label={minimized ? "Разгъни" : "Свий"}
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          data-chrome
          className="grid size-9 place-items-center rounded-[8px] hover:bg-white/10"
          onClick={onClose}
          aria-label="Затвори чата"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      {!minimized && (
        <div className="flex min-h-0 flex-1 flex-col">
          {isSelf ? (
            <p className="p-5 text-ink-2">
              Това е вашият публичен профил. Клиентите ви пишат оттук.{" "}
              <Link href="/tabla/profil" className="link font-bold">
                Редактирай профила
              </Link>
            </p>
          ) : !me ? (
            <SignInPrompt craftsman={craftsman} date={props.date} />
          ) : convId ? (
            <DockThread
              key={convId}
              conversationId={convId}
              me={me}
              craftsman={craftsman}
              banned={props.banned}
              draft={props.ask ? draftFor(props.ask.date, props.ask.slot) : ""}
            />
          ) : (
            <FirstMessage
              {...props}
              onStarted={(id) => {
                setStarted(id);
                props.onAskUsed();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function draftFor(date: string, slot: Slot | null) {
  return `Здравейте! Удобно ли ви е ${relativeDay(date)}${slot ? `, ${slotLabel(slot)}` : ""}?`;
}

function SignInPrompt({ craftsman, date }: { craftsman: Craftsman; date: string | null }) {
  const next = `/maistori/${craftsman.slug}${date ? `?data=${date}` : ""}#pishi`;
  return (
    <div className="grid content-start gap-4 bg-ink p-5 text-white max-sm:flex-1">
      <p className="display text-3xl text-rule">Пиши на {craftsman.firstName}</p>
      <p className="text-[#d8d4c8]">
        Влезте или се регистрирайте, за да пишете. Отнема по-малко от минута
        {date ? `, а избраната дата (${relativeDay(date)}) ще се запази` : ""}.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href={`/vhod?next=${encodeURIComponent(next)}`} className="btn btn-rule">
          Вход
        </Link>
        <Link href={`/registratsia?next=${encodeURIComponent(next)}`} className="btn border border-white/40 text-white hover:bg-white/10">
          Регистрация
        </Link>
      </div>
    </div>
  );
}

function FirstMessage({
  craftsman,
  workOptions,
  date,
  slot,
  onDate,
  today,
  busyDay,
  onStarted,
}: Props & { onStarted: (id: string) => void }) {
  const [state, action] = useActionState<FormState, FormData>(startConversation, {});
  const [body, setBody] = useState("");
  const [prevState, setPrevState] = useState(state);
  if (prevState !== state) {
    setPrevState(state);
    if (state.values?.body !== undefined) setBody(state.values.body);
  }
  useEffect(() => {
    if (state.ok && state.id) onStarted(state.id);
  }, [state, onStarted]);
  const priced = workOptions.filter((o) => o.priced);
  const other = workOptions.filter((o) => !o.priced);
  const cats = craftsman.categories ?? [];
  const [catSlug, setCatSlug] = useState(cats[0]?.slug ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [askOpen, setAskOpen] = useState(false);
  const questions = questionsFor(catSlug);
  const composed = composeAnswers(questions, answers);

  return (
    <form
      action={action}
      className="grid flex-1 content-start gap-3 overflow-y-auto bg-ink p-4 text-white [&_.error-text]:text-[#ff9f94]"
      noValidate
    >
      <input type="hidden" name="craftsmanId" value={craftsman.id} />
      <input type="hidden" name="slug" value={craftsman.slug} />
      <input type="hidden" name="inline" value="1" />
      <input type="hidden" name="date" value={date ?? ""} />
      <input type="hidden" name="slot" value={date && slot ? slot : ""} />
      <div>
        <label htmlFor="dock-date" className="label text-white">
          Дата <span className="font-normal text-[#bdb8aa]">(по желание)</span>
        </label>
        <input
          id="dock-date"
          type="date"
          min={today}
          className="field"
          value={date ?? ""}
          onChange={(e) => onDate(e.target.value || null)}
        />
        {date && (
          <p className="hint text-[#bdb8aa]">
            {slot ? `Предпочитано: ${slotLabel(slot)}. ` : ""}
            {busyDay ? "Отбелязан като зает: питайте дали може. " : ""}
            <button type="button" className="underline" onClick={() => onDate(null)}>
              Без конкретна дата
            </button>
          </p>
        )}
      </div>
      <div>
        <label htmlFor="dock-work" className="label text-white">
          Каква работа
        </label>
        <select id="dock-work" name="work" className="field" defaultValue={state.values?.work ?? ""}>
          <option value="">Не е задължително</option>
          {priced.length > 0 && (
            <optgroup label="От ценоразписа">
              {priced.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
          {other.length > 0 && (
            <optgroup label={priced.length ? "Други (цена в чата)" : "Услуги"}>
              {other.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      <div className="rounded-[8px] border border-white/25">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm font-bold"
          onClick={() => setAskOpen((v) => !v)}
          aria-expanded={askOpen}
        >
          <span>Помогнете на майстора да даде цена</span>
          <span aria-hidden>{askOpen ? "−" : "+"}</span>
        </button>
        {askOpen && (
          <div className="grid gap-3 border-t border-white/25 p-3">
            {cats.length > 1 && (
              <div>
                <label htmlFor="dock-q-cat" className="label text-white">
                  Вид работа
                </label>
                <select id="dock-q-cat" className="field" value={catSlug} onChange={(e) => { setCatSlug(e.target.value); setAnswers({}); }}>
                  {cats.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {questions.map((q) => (
              <div key={q.id}>
                <label htmlFor={`dock-q-${q.id}`} className="label text-white">
                  {q.label}
                </label>
                {q.options ? (
                  <select id={`dock-q-${q.id}`} className="field" value={answers[q.id] ?? ""} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}>
                    <option value="">Не е задължително</option>
                    {q.options.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input id={`dock-q-${q.id}`} className="field" maxLength={160} value={answers[q.id] ?? ""} placeholder={q.placeholder} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} />
                )}
              </div>
            ))}
            <button
              type="button"
              className="btn btn-rule btn-sm justify-self-start"
              disabled={!composed}
              onClick={() => {
                setBody((b) => (b.trim() ? `${b.trim()}

${composed}` : composed));
                setAnswers({});
                setAskOpen(false);
              }}
            >
              Добави към съобщението
            </button>
            <p className="hint text-[#bdb8aa]">Снимки на проблема можете да изпратите в разговора веднага след първото съобщение.</p>
          </div>
        )}
      </div>
      <div>
        <label htmlFor="dock-body" className="label text-white">
          Съобщение
        </label>
        <textarea
          id="dock-body"
          name="body"
          className="field"
          rows={3}
          maxLength={4000}
          required
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={`Здравейте! Трябва ми… Адресът е в … Удобно ли ви е${date ? ` ${relativeDay(date)}` : ""}?`}
          aria-invalid={Boolean(state.errors?.body)}
          aria-describedby={state.errors?.body ? "dock-body-err" : "dock-body-hint"}
        />
        <p id="dock-body-hint" className="hint text-[#bdb8aa]">
          Телефонът ви остава скрит, освен ако не го напишете.
        </p>
        <FieldError id="dock-body-err" message={state.errors?.body} />
      </div>
      <FormMessage state={state.ok ? {} : state} />
      <SubmitButton className="btn btn-rule w-full" pendingText="Изпращаме…">
        Изпрати съобщение
      </SubmitButton>
    </form>
  );
}

type Loaded = {
  messages: ChatMessage[];
  bookings: Booking[];
  shares: Share[];
  phone: string | null;
  requestedDate: string | null;
  categoryName: string | null;
};

function DockThread({
  conversationId,
  me,
  craftsman,
  banned,
  draft,
}: {
  conversationId: string;
  me: string;
  craftsman: Craftsman;
  banned: boolean;
  draft: string;
}) {
  const [data, setData] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stale = false;
    const supabase = createClient();
    Promise.all([
      supabase.from("conversations").select("requested_date, category:categories(name)").eq("id", conversationId).maybeSingle(),
      supabase
        .from("messages")
        .select("id, sender_id, body, meta, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("bookings")
        .select("id, booking_date, end_date, start_time, end_time, kind, status, note, proposed_by, craftsman_id, client_id")
        .eq("conversation_id", conversationId)
        .order("created_at"),
      supabase.rpc("conversation_partner_phone", { p_conversation: conversationId }),
      supabase
        .from("photo_share_requests")
        .select("id, message_id, path, status, published_at, requested_by")
        .eq("conversation_id", conversationId),
    ]).then(([conv, msgs, bookings, phone, shares]) => {
      if (stale) return;
      if (conv.error || msgs.error || !conv.data) return setFailed(true);
      const cat = Array.isArray(conv.data.category) ? conv.data.category[0] : conv.data.category;
      setData({
        messages: ((msgs.data ?? []) as ChatMessage[]).reverse(),
        bookings: (bookings.data ?? []) as Booking[],
        shares: (shares.data ?? []) as Share[],
        phone: phone.data ?? null,
        requestedDate: conv.data.requested_date,
        categoryName: cat?.name ?? null,
      });
    });
    return () => {
      stale = true;
    };
  }, [conversationId]);

  if (failed)
    return (
      <p className="p-5 text-ink-2">
        Разговорът не се зареди.{" "}
        <Link href={`/saobshtenia/${conversationId}`} className="link font-bold">
          Отвори го в „Съобщения“
        </Link>
      </p>
    );
  if (!data) return <p className="p-5 text-ink-3">Зареждаме разговора…</p>;

  return (
    <div className="flex min-h-0 flex-1 flex-col [&>section]:flex-1">
      <Thread
        conversationId={conversationId}
        me={me}
        iAmClient
        partner={{ id: craftsman.id, name: craftsman.name, avatar: craftsman.avatar, slug: craftsman.slug, phone: data.phone }}
        requestedDate={data.requestedDate}
        categoryName={data.categoryName}
        initial={data.messages}
        initialBookings={data.bookings}
        initialShares={data.shares}
        craftsmanId={craftsman.id}
        banned={banned}
        embedded
        draft={draft}
      />
    </div>
  );
}
