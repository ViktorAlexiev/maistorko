"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { Thread, type ChatMessage } from "@/app/saobshtenia/[id]/thread";
import type { Booking } from "@/app/saobshtenia/[id]/booking";
import { toReviewBox, type MyReview, type ReviewBoxKind } from "@/app/saobshtenia/[id]/review-box-kind";
import type { Share } from "@/app/saobshtenia/[id]/chat-photos";
import { Avatar } from "@/components/avatar";
import { FirstMessage } from "@/components/first-message";
import { createClient } from "@/lib/supabase/client";
import { relativeDay } from "@/lib/format";
import { slotLabel, type Slot } from "@/lib/slots";

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

export type Craftsman = {
  id: string;
  name: string;
  firstName: string;
  avatar: string | null;
  slug: string;
  city?: string | null;
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
  onSlot: (s: Slot | null) => void;
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
  const { open, onClose, onAskUsed, craftsman, me, isSelf, conversationId } = props;
  const [minimized, setMinimized] = useState(false);
  const [started, setStarted] = useState<string | null>(null);
  // The id of the conversation the first message creates: photos are uploaded into its folder before it exists
  const [newId, setNewId] = useState<string | null>(null);
  // Whether the form was on screen when the window opened (no conversation yet)
  const [formOpened, setFormOpened] = useState(conversationId === null);
  // The profile refresh can bring the new conversation before the form reports it: the form stays until it has.
  // A window opened after that (the form was closed while sending) shows the conversation instead.
  const showForm = started === null && (conversationId === null || (formOpened && conversationId === newId));
  const convId = started ?? (showForm ? null : conversationId);
  const root = useRef<HTMLDivElement>(null);

  // Reopening always shows the window expanded
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMinimized(false);
      setFormOpened(conversationId === null);
    }
  }

  useEffect(() => {
    if (!open || convId || newId) return;
    // not during render: the component is rendered on the server too, where the id would differ
    const t = setTimeout(() => setNewId(crypto.randomUUID()), 0);
    return () => clearTimeout(t);
  }, [open, convId, newId]);

  useEffect(() => {
    if (convId && convId === newId) onAskUsed();
  }, [convId, newId, onAskUsed]);

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

  // Once opened, the window stays mounted (hidden while closed) so the text and photos survive × and Esc
  const [everOpened, setEverOpened] = useState(open);
  if (open && !everOpened) setEverOpened(true);
  if (!open && !everOpened) return null;

  return (
    <div
      ref={root}
      hidden={!open}
      role="dialog"
      aria-modal="false"
      aria-label={`Чат с ${craftsman.name}`}
      className={`dock-in fixed z-50 flex-col overflow-hidden bg-surface shadow-[var(--shadow-lg)] sm:bottom-0 sm:right-6 sm:w-[25rem] sm:rounded-t-[14px] ${
        open ? "flex" : "hidden"
      } ${
        minimized ? "max-sm:inset-x-0 max-sm:bottom-0" : "max-sm:inset-0 sm:h-[min(38rem,calc(100dvh-5rem))]"
      }`}
    >
      <header className="flex shrink-0 items-center gap-2.5 bg-surface py-2 pl-3.5 pr-1.5">
        <button
          type="button"
          data-chrome
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[6px] text-left"
          onClick={() => setMinimized((m) => !m)}
          aria-expanded={!minimized}
          aria-label={minimized ? "Разгъни чата" : "Свий чата"}
        >
          <Avatar name={craftsman.name} url={craftsman.avatar} size={40} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[1.125rem] font-extrabold leading-tight">{craftsman.name}</span>
            <span className="block truncate text-sm leading-snug text-ink-2">{convId ? "Разговор" : "Ново съобщение"}</span>
          </span>
        </button>
        {convId && (
          <Link
            href={`/saobshtenia/${convId}`}
            data-chrome
            className="btn btn-ghost size-11 shrink-0 p-0"
            aria-label="Отвори в „Съобщения“"
            title="Отвори в „Съобщения“"
          >
            <ExternalLink className="size-5" aria-hidden />
          </Link>
        )}
        <button
          type="button"
          data-chrome
          className="btn btn-ghost size-11 shrink-0 p-0"
          onClick={onClose}
          aria-label="Затвори чата"
          title="Затвори"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      {/* hidden, not unmounted: what was typed and the photos picked survive a collapse and closing the window */}
      <div className={minimized ? "hidden" : "flex min-h-0 flex-1 flex-col"}>
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
            draft={convId === newId || convId === started || !props.ask ? "" : draftFor(props.ask.date, props.ask.slot)}
            collapsed={minimized || !open}
          />
        ) : newId ? (
          <FirstMessage
            craftsman={craftsman}
            workOptions={props.workOptions}
            date={props.date}
            slot={props.slot}
            onDate={props.onDate}
            onSlot={props.onSlot}
            today={props.today}
            busyDay={props.busyDay}
            newId={newId}
            onStarted={(id) => {
              setStarted(id);
              onAskUsed();
            }}
          />
        ) : null}
      </div>
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

type Loaded = {
  messages: ChatMessage[];
  bookings: Booking[];
  shares: Share[];
  phone: string | null;
  requestedDate: string | null;
  categoryName: string | null;
  sameDay: boolean;
  reviewBox: ReviewBoxKind | null;
  myReview: MyReview | null;
};

function DockThread({
  conversationId,
  me,
  craftsman,
  banned,
  draft,
  collapsed,
}: {
  conversationId: string;
  me: string;
  craftsman: Craftsman;
  banned: boolean;
  draft: string;
  collapsed: boolean;
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
      supabase.from("craftsman_profiles").select("short_notice").eq("id", craftsman.id).maybeSingle(),
      supabase.rpc("review_box", { p_conversation: conversationId }),
      supabase.from("reviews").select("rating, body").eq("client_id", me).eq("craftsman_id", craftsman.id).maybeSingle(),
    ]).then(([conv, msgs, bookings, phone, shares, profile, box, review]) => {
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
        sameDay: profile.data?.short_notice !== false,
        reviewBox: toReviewBox(box.data),
        myReview: review.data ?? null,
      });
    });
    return () => {
      stale = true;
    };
  }, [conversationId, craftsman.id, me]);

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
        craftsmanSameDay={data.sameDay}
        banned={banned}
        embedded
        hidden={collapsed}
        draft={draft}
        reviewBox={data.reviewBox}
        myReview={data.myReview}
      />
    </div>
  );
}
