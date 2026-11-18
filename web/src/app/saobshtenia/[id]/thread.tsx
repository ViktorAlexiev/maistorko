"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, BadgeEuro, CalendarDays, CalendarPlus, Check, CheckCheck, ChevronUp, Ellipsis, Flag, Handshake, Phone, RotateCw, SendHorizontal, Star } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { formatDate, formatTime, relativeDay, servicePrice, todayISO, type PriceKind, type PriceUnit } from "@/lib/format";
import { slotLabel } from "@/lib/slots";
import { BookingCard, BookingSheet, bookingWhen, KIND_LABEL, type Booking } from "./booking";
import { Menu } from "./menu";
import { OfferCard, Rivet, type ChatOffer, type Line } from "./offer-card";
import { ReportButton } from "@/components/report-button";
import { QuickReplies } from "./quick-replies";
import { ReviewBox } from "./review-box";
import { toReviewBox, type MyReview, type ReviewBoxKind } from "./review-box-kind";
import { OfferSheet, type CreatedOffer } from "./offer-sheet";
import {
  AttachButton,
  AttachmentStrip,
  MAX_ATTACHMENTS,
  PhotoTile,
  publishToPortfolio,
  uploadChatPhotos,
  type Attachment,
  type Share,
} from "./chat-photos";

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
    photos?: { path: string }[];
    share_request?: string;
    offer?: string;
    title?: string;
    total?: number | string;
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
  partner: { id: string | null; name: string; avatar: string | null; slug: string | null; phone: string | null; href?: string };
  requestedDate: string | null;
  categoryName: string | null;
  initial: ChatMessage[];
  initialBookings: Booking[];
  initialShares?: Share[];
  /** the craftsman a booking would be for (the other party, or the one a company conversation is assigned to) */
  craftsmanId: string | null;
  /** that craftsman takes same-day visits (short_notice); a missing profile row counts as yes, the database decides */
  craftsmanSameDay: boolean;
  /** conversation with a company: who handles it */
  org?: { name: string; slug: string; canAssign: boolean; team: { id: string; name: string }[]; assignedTo: string | null; assignedName: string | null };
  banned: boolean;
  /** Inside the chat window on a profile: the window draws its own header. */
  embedded?: boolean;
  /** The window is collapsed: the thread stays mounted but is not shown, so nothing is marked read and the view is restored on show. */
  hidden?: boolean;
  /** When the old message texts were deleted after 60 idle days (null = never) */
  purgedAt?: string | null;
  /** Text to put in the composer, e.g. a question about the day picked on the profile. */
  draft?: string;
  /** the craftsman has offers by link (Pro) */
  canOffer?: boolean;
  /** which yellow box sits above the composer (decided by the database); null = none */
  reviewBox: ReviewBoxKind | null;
  /** the client's own review of this craftsman, to fill the form with */
  myReview: MyReview | null;
};

let tempSeq = 0;

/** Enter sends on a desktop; on a touch screen or a narrow window it makes a new line and only the arrow sends. */
export const enterSends = () => typeof window !== "undefined" && !window.matchMedia("(pointer: coarse), (max-width: 767px)").matches;

/** "утре · 09:00–11:00", "във вторник · цял ден"; several days keep their dates */
function upcomingWhen(b: Booking, today: string) {
  if (b.end_date) return bookingWhen(b);
  const time = b.start_time ? `${b.start_time.slice(0, 5)}–${b.end_time!.slice(0, 5)}` : "цял ден";
  return `${relativeDay(b.booking_date, today)} · ${time}`;
}

/** what the review box depends on: how many messages there are and the state of each booking */
const boxKeyOf = (n: number, bs: Booking[]) => `${n}|${bs.map((b) => `${b.id}:${b.status}`).join(",")}`;

const sofiaDay = (ts: string) => new Date(ts).toLocaleDateString("en-CA", { timeZone: "Europe/Sofia" });

export function Thread({ conversationId, me, iAmClient, partner, requestedDate, categoryName, initial, initialBookings, initialShares = [], craftsmanId, craftsmanSameDay, org, banned, embedded, hidden = false, draft, purgedAt, canOffer, reviewBox: initialBox, myReview }: Props) {
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
  const [shares, setShares] = useState<Share[]>(initialShares);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sending, setSending] = useState(false);
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [published, setPublished] = useState(false);
  const [reviewBox, setReviewBox] = useState<ReviewBoxKind | null>(initialBox);
  const [offerOpen, setOfferOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [offers, setOffers] = useState<ChatOffer[]>([]);
  const canBook = Boolean(craftsmanId) && (iAmClient || craftsmanId === me);
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const atBottom = useRef(true);

  const hiddenRef = useRef(hidden);
  const markRead = useCallback(async () => {
    if (hiddenRef.current) return;
    await supabase.rpc("mark_conversation_read", { p_conversation: conversationId });
    window.dispatchEvent(new Event("maistorko:read"));
  }, [supabase, conversationId]);

  // Several events can trigger a refresh at once; only the newest response wins.
  const bookingSeq = useRef(0);
  const refreshBookings = useCallback(async () => {
    const seq = ++bookingSeq.current;
    const { data } = await supabase
      .from("bookings")
      .select("id, booking_date, end_date, start_time, end_time, kind, status, note, proposed_by, craftsman_id, client_id")
      .eq("conversation_id", conversationId)
      .order("created_at");
    if (data && seq === bookingSeq.current) setBookings(data as Booking[]);
  }, [supabase, conversationId]);

  // The rows of the offers in this conversation; the function does not mark an offer as seen
  const offerSeq = useRef(0);
  const refreshOffers = useCallback(async () => {
    const seq = ++offerSeq.current;
    const { data } = await supabase.rpc("chat_offers", { p_conversation: conversationId });
    if (data && seq === offerSeq.current) {
      setOffers(data.map((o) => ({ ...o, lines: (o.lines as Line[] | null) ?? [], viewed_at: o.viewed_at ?? null })));
    }
  }, [supabase, conversationId]);

  const refreshShares = useCallback(async () => {
    const { data } = await supabase
      .from("photo_share_requests")
      .select("id, message_id, path, status, published_at, requested_by")
      .eq("conversation_id", conversationId);
    if (data) setShares(data as Share[]);
  }, [supabase, conversationId]);

  // The yellow box above the composer depends on the messages (an invite) and the bookings (an upcoming one): ask the database again when they change
  const boxSeq = useRef(0);
  const refreshReviewBox = useCallback(async () => {
    const seq = ++boxSeq.current;
    const { data } = await supabase.rpc("review_box", { p_conversation: conversationId });
    if (seq === boxSeq.current) setReviewBox(toReviewBox(data));
  }, [supabase, conversationId]);
  const boxKey = useRef(boxKeyOf(initial.length, initialBookings));
  useEffect(() => {
    const key = boxKeyOf(messages.length, bookings);
    if (key === boxKey.current) return;
    boxKey.current = key;
    refreshReviewBox();
  }, [messages.length, bookings, refreshReviewBox]);

  // Photos live in a private bucket: ask for short-lived signed links for the ones on screen
  useEffect(() => {
    const need = [...new Set(messages.flatMap((m) => m.meta?.photos ?? []).map((p) => p.path))].filter((p) => !urls[p]);
    if (!need.length) return;
    let alive = true;
    supabase.storage
      .from("chat-photos")
      .createSignedUrls(need, 3600)
      .then(({ data }) => {
        if (!alive || !data) return;
        setUrls((u) => {
          const n = { ...u };
          for (const d of data) if (d.path && d.signedUrl) n[d.path] = d.signedUrl;
          return n;
        });
      });
    return () => {
      alive = false;
    };
  }, [messages, urls, supabase]);

  // Realtime: new messages and booking changes in this conversation (RLS-filtered on the server)
  useEffect(() => {
    markRead();
    refreshOffers();
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
          if (m.meta?.share_request) refreshShares();
          if (m.meta?.offer) refreshOffers();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "photo_share_requests", filter: `conversation_id=eq.${conversationId}` },
        () => refreshShares(),
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
  }, [supabase, conversationId, me, markRead, refreshBookings, refreshShares, refreshOffers]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // The composer grows with its text, including a prefilled draft and the reset after sending
  const fitComposer = useCallback(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    // border-box: scrollHeight leaves out the border, so add it back or a scrollbar appears
    el.style.height = `${Math.min(el.scrollHeight + el.offsetHeight - el.clientHeight, 160)}px`;
  }, []);
  useLayoutEffect(fitComposer, [text, fitComposer]);

  // A collapsed window hides the thread (display: none loses the scroll position and measures nothing):
  // when it is shown again, go back to the bottom if the reader was there, re-measure the composer, mark read
  useLayoutEffect(() => {
    const was = hiddenRef.current;
    hiddenRef.current = hidden;
    if (!was || hidden) return;
    const el = scroller.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
    fitComposer();
    if (document.visibilityState === "visible") markRead();
  }, [hidden, fitComposer, markRead]);

  async function send(body: string, tempId = crypto.randomUUID(), photos?: string[]) {
    const meta = photos?.length ? { photos: photos.map((path) => ({ path })) } : {};
    const optimistic: ChatMessage = {
      id: --tempSeq,
      tempId,
      sender_id: me,
      body,
      meta,
      created_at: new Date().toISOString(),
      pending: true,
    };
    atBottom.current = true;
    setMessages((xs) => [...xs.filter((x) => x.tempId !== tempId), optimistic]);
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: me, body, ...(photos?.length ? { meta } : {}) })
      .select("id, sender_id, body, meta, created_at")
      .single();
    setMessages((xs) => {
      if (error || !data) return xs.map((x) => (x.tempId === tempId ? { ...x, pending: false, failed: true } : x));
      const withoutTemp = xs.filter((x) => x.tempId !== tempId);
      return withoutTemp.some((x) => x.id === data.id) ? withoutTemp : [...withoutTemp, data as ChatMessage];
    });
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const body = text.trim();
    if ((!body && attachments.length === 0) || body.length > 4000 || sending) return;
    if (attachments.length === 0) {
      setText("");
      send(body);
      box.current?.focus();
      return;
    }
    setSending(true);
    const { paths, errors } = await uploadChatPhotos(supabase, conversationId, attachments.map((a) => a.file));
    errors.forEach((msg) => toast.error(msg));
    attachments.forEach((a) => URL.revokeObjectURL(a.preview));
    setAttachments([]);
    setSending(false);
    setText("");
    if (paths.length) await send(body || (paths.length === 1 ? "📷 Снимка" : `📷 Снимки (${paths.length})`), undefined, paths);
    else if (body) await send(body);
    box.current?.focus();
  }

  function pickFiles(files: File[]) {
    const room = MAX_ATTACHMENTS - attachments.length;
    if (files.length > room) toast.message(`Най-много ${MAX_ATTACHMENTS} снимки наведнъж.`);
    setAttachments((xs) => [
      ...xs,
      ...files.slice(0, Math.max(room, 0)).map((file) => ({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file) })),
    ]);
  }

  function removeAttachment(key: string) {
    setAttachments((xs) => {
      const gone = xs.find((a) => a.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return xs.filter((a) => a.key !== key);
    });
  }

  // Craftsman: add a chat photo to the public portfolio (his own, or the client's after the client agreed)
  async function addToProfile(path: string, shareId?: string) {
    setBusyPath(path);
    try {
      await publishToPortfolio(supabase, me, path);
      if (shareId) {
        await supabase.rpc("mark_photo_share_published", { p_request: shareId });
        await refreshShares();
      }
      toast.success("Снимката е добавена в профила ти.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Снимката не беше добавена.");
    } finally {
      setBusyPath(null);
    }
  }

  async function askShare(messageId: number, path: string) {
    setBusyPath(path);
    const { error } = await supabase.rpc("request_photo_share", { p_message: messageId, p_path: path });
    setBusyPath(null);
    if (error) return void toast.error(error.message);
    toast.success("Питахме клиента. Снимката се добавя само ако се съгласи.");
    refreshShares();
  }

  async function respondShare(id: string, accept: boolean) {
    const { error } = await supabase.rpc("respond_photo_share", { p_request: id, p_accept: accept });
    if (error) toast.error(error.message);
    refreshShares();
  }

  function photoAction(m: ChatMessage, path: string) {
    if (iAmClient || m.pending || m.failed || m.id < 0) return undefined;
    const busy = busyPath === path;
    if (m.sender_id === me) return { label: "Покажи в профила", disabled: busy, onClick: () => addToProfile(path) };
    if (org) return undefined; // asking for consent is for personal conversations
    const share = shares.find((s) => s.message_id === m.id && s.path === path);
    if (!share) return { label: "Поискай съгласие", disabled: busy, onClick: () => askShare(m.id, path) };
    if (share.status === "pending") return { label: "Чака клиента", disabled: true };
    if (share.status === "declined") return { label: "Клиентът не се съгласи", disabled: true };
    if (share.published_at) return { label: "В профила ти", disabled: true, done: true };
    return { label: "Добави в профила", disabled: busy, onClick: () => addToProfile(path, share.id) };
  }

  const shareById = new Map(shares.map((s) => [s.id, s]));

  // Craftsman: an offer written from the chat arrives as a card the client can open and accept
  async function sendOffer(o: CreatedOffer) {
    const body = `Оферта: ${o.title}, ${o.total.toFixed(2).replace(".", ",")} €`;
    const { data, error } = await supabase
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: me, body, meta: { offer: o.token, title: o.title, total: o.total } })
      .select("id, sender_id, body, meta, created_at")
      .single();
    if (error || !data) return void toast.error("Офертата е записана, но съобщението не стигна. Изпратете линка от „Оферти“.");
    atBottom.current = true;
    setMessages((xs) => (xs.some((x) => x.id === data.id) ? xs : [...xs, data as ChatMessage]));
    refreshOffers();
    toast.success("Офертата е изпратена в разговора.");
  }

  const partnerFirst = partner.name.split(" ")[0];
  // Page: the whole conversation is Card Surface and cards step back to paper. In the profile window it is the other way round.
  const card = embedded ? "bg-surface" : "bg-paper";
  const today = todayISO();
  const byId = new Map(bookings.map((b) => [b.id, b]));
  const firstMessageFor = new Map<string, number>();
  for (const m of messages) if (m.meta?.booking_id && !firstMessageFor.has(m.meta.booking_id)) firstMessageFor.set(m.meta.booking_id, m.id);
  const upcoming = bookings
    .filter((b) => b.status === "confirmed" && b.booking_date >= today)
    .sort((a, b) => (a.booking_date + (a.start_time ?? "")).localeCompare(b.booking_date + (b.start_time ?? "")))[0];

  return (
    <section aria-label={`Разговор с ${partner.name}`} className={`flex min-h-0 flex-col ${embedded ? "bg-paper" : "bg-surface"}`}>
      {/* Header */}
      {!embedded && (
        <header className="relative z-20 flex items-center gap-2 bg-surface px-1.5 py-2 sm:px-3">
          <Link href="/saobshtenia" className="grid size-11 shrink-0 place-items-center rounded-[6px] hover:bg-ink/5 md:hidden" aria-label="Всички разговори">
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <div className="relative ml-1.5 shrink-0 md:ml-0">
            <Avatar name={partner.name} url={partner.avatar} size={40} />
            <span
              className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full ring-2 ring-surface ${live ? "bg-free" : "bg-line-strong"}`}
              title={live ? "Съобщенията пристигат веднага" : "Свързваме се…"}
              role="img"
              aria-label={live ? "Връзката е активна" : "Свързване"}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[1.125rem] font-extrabold leading-tight">
              {partner.href || partner.slug ? (
                <Link href={partner.href ?? `/maistori/${partner.slug}`} className="hover:underline">
                  {partner.name}
                </Link>
              ) : (
                partner.name
              )}
            </p>
            <p className="text-sm leading-snug text-ink-2">
              {requestedDate && (
                <>
                  {relativeDay(requestedDate)}
                  {requestedDate < today && " (минала дата)"}
                </>
              )}
              {requestedDate && categoryName && " · "}
              {categoryName}
            </p>
          </div>
          {partner.phone && (
            <a href={`tel:${partner.phone.replace(/\s/g, "")}`} className="btn btn-ghost size-11 shrink-0 p-0" aria-label={`Обади се на ${partnerFirst}`} title={partner.phone}>
              <Phone className="size-5" aria-hidden />
            </a>
          )}
          <Menu
            label="Още действия"
            triggerClass="btn btn-ghost size-11 p-0"
            trigger={() => <Ellipsis className="size-5" aria-hidden />}
            items={[
              {
                label: "Докладвай",
                hint: "Съобщи ни за проблем с този разговор",
                icon: <Flag className="mt-0.5 size-5 shrink-0" aria-hidden />,
                onSelect: () => setReportOpen(true),
              },
            ]}
          />
          <ReportButton type="conversation" targetId={conversationId} signedIn loginHref="/vhod" label="" className="hidden" open={reportOpen} onOpenChange={setReportOpen} />
        </header>
      )}
      {org && !iAmClient && (
        <AssignBar conversationId={conversationId} org={org} me={me} />
      )}
      {upcoming && (
        <div className="flex min-h-11 items-center gap-2.5 bg-rule-soft pl-4 pr-1.5">
          <Rivet kind="filled" />
          <p className="numerals min-w-0 flex-1 text-[1.1rem] leading-tight">
            {KIND_LABEL[upcoming.kind]} {upcomingWhen(upcoming, today)}
          </p>
          <button
            type="button"
            className="min-h-11 px-3 text-sm font-bold text-ink-2 underline"
            onClick={() => document.getElementById(`booking-${upcoming.id}`)?.scrollIntoView({ block: "center" })}
          >
            Виж
          </button>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5"
        onScroll={(e) => {
          const el = e.currentTarget;
          atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {purgedAt && (
          <p className="mx-auto mb-3 max-w-2xl rounded-[8px] bg-surface-2 px-3 py-2 text-center text-sm text-ink-2">
            Старите съобщения са изтрити автоматично след 60 дни без разговор. Уговорките и отзивите остават.
          </p>
        )}
        <ol className="mx-auto grid max-w-2xl gap-1.5">
          {messages.map((m, i) => {
            const mine = m.sender_id === me;
            const day = sofiaDay(m.created_at);
            const showDay = i === 0 || day !== sofiaDay(messages[i - 1].created_at);
            return (
              <li key={m.tempId ?? m.id} className="msg grid">
                {showDay && (
                  <p className="numerals my-2 text-center text-base text-ink-3">
                    {day === today ? "днес" : relativeDay(day, today) === "утре" ? formatDate(day) : formatDate(day, true)}
                  </p>
                )}
                {m.meta?.offer && /^[0-9a-f-]{36}$/.test(m.meta.offer) && !m.meta.share_request && !m.meta.booking_id ? (
                  <OfferCard
                    token={m.meta.offer}
                    title={m.meta.title ?? ""}
                    total={m.meta.total != null ? Number(m.meta.total) : null}
                    offer={offers.find((o) => o.token === m.meta!.offer)}
                    iAmClient={iAmClient}
                    partnerFirst={partnerFirst}
                    bg={card}
                  />
                ) : m.meta?.event === "review_request" && !m.meta.share_request && !m.meta.booking_id ? (
                  <div className={`mx-auto my-1.5 w-full max-w-md rounded-[10px] p-3.5 ${card}`}>
                    <p className="flex items-center gap-1.5 text-sm font-bold text-ink-2">
                      <Star className="size-4" aria-hidden /> Работата е свършена
                    </p>
                    <p className="mt-0.5">{m.body}</p>
                    {iAmClient ? (
                      published ? (
                        <p className="mt-2 text-sm font-semibold text-ink-2">Отзивът е публикуван.</p>
                      ) : craftsmanId && partner.slug ? (
                        <button type="button" className="btn btn-primary mt-2 w-full" onClick={() => setReviewFormOpen(true)}>
                          Остави отзив
                        </button>
                      ) : null
                    ) : (
                      <p className="mt-2 text-sm text-ink-3">Клиентът може да остави отзив от този разговор.</p>
                    )}
                  </div>
                ) : m.meta?.share_request ? (
                  m.meta.event === "asked" ? (
                    <div className={`mx-auto my-1.5 w-full max-w-md rounded-[10px] p-3.5 ${card}`}>
                      <p className="text-sm font-bold text-ink-2">Снимка в профила</p>
                      <p className="mt-0.5">{m.body}</p>
                      {(() => {
                        const share = shareById.get(m.meta!.share_request!);
                        if (!share) return null;
                        if (share.status !== "pending") {
                          return <p className="mt-2 text-sm font-semibold text-ink-3">{share.status === "approved" ? "Съгласие дадено." : "Отказано."}</p>;
                        }
                        return iAmClient ? (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <button type="button" className="btn bg-free text-white hover:bg-free/90" onClick={() => respondShare(share.id, true)}>
                              Съгласен съм
                            </button>
                            <button type="button" className="btn btn-outline" onClick={() => respondShare(share.id, false)}>
                              Не
                            </button>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-ink-2">Чакаме отговор от {partnerFirst}.</p>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="my-1 text-center text-sm text-ink-2">
                      <span className="font-semibold">{mine ? "Вие" : partnerFirst}:</span> {m.body}
                      <span className="ml-1.5 text-xs text-ink-3">{formatTime(m.created_at)}</span>
                    </p>
                  )
                ) : m.meta?.booking_id ? (
                  firstMessageFor.get(m.meta.booking_id) === m.id && byId.get(m.meta.booking_id) ? (
                    <BookingCard booking={byId.get(m.meta.booking_id)!} me={me} partnerName={partner.name} bg={card} onChanged={refreshBookings} />
                  ) : (
                    <p className="my-1 text-center text-sm text-ink-2">
                      <span className="font-semibold">{mine ? "Вие" : partnerFirst}:</span> {m.body}
                      <span className="ml-1.5 text-xs text-ink-3">{formatTime(m.created_at)}</span>
                    </p>
                  )
                ) : (
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-[14px] px-3.5 py-2 sm:max-w-[75%] ${mine ? "rounded-br-[4px]" : "rounded-bl-[4px]"} ${
                      m.failed ? "bg-danger-soft text-ink" : mine ? "bg-ink text-white" : `${card} text-ink`
                    }`}
                  >
                    {(m.meta?.date || m.meta?.service || m.meta?.category) && (
                      <p
                        className={`mb-1.5 inline-flex flex-wrap items-center gap-x-1.5 rounded-[6px] px-2 py-1 text-sm font-bold text-ink ${
                          mine ? "bg-rule" : "bg-rule-soft"
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
                    {m.meta?.photos && m.meta.photos.length > 0 && (
                      <div className="mb-1.5 flex gap-2 overflow-x-auto [&>*]:shrink-0">
                        {m.meta.photos.map((p) => (
                          <PhotoTile key={p.path} url={urls[p.path]} action={photoAction(m, p.path)} />
                        ))}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    <p className={`mt-0.5 flex items-center justify-end gap-1 text-[0.72rem] ${mine && !m.failed ? "text-white/70" : "text-ink-3"}`}>
                      <span className="numerals text-[0.85rem]">{formatTime(m.created_at)}</span>
                      {mine &&
                        (m.pending ? (
                          <>
                            <Check className="size-3.5" aria-hidden />
                            Изпраща се
                          </>
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
                    className="mt-1 inline-flex min-h-11 items-center gap-1.5 justify-self-end px-1 text-sm font-bold text-danger"
                  >
                    <RotateCw className="size-3.5" aria-hidden /> Не е изпратено · Опитай пак
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <ReviewBox
        box={reviewBox}
        partnerFirst={partnerFirst}
        craftsmanId={iAmClient ? craftsmanId : null}
        slug={partner.slug}
        myReview={myReview}
        conversationId={conversationId}
        formOpen={reviewFormOpen}
        onFormOpenChange={setReviewFormOpen}
        onPublished={() => {
          setPublished(true);
          refreshReviewBox();
        }}
        onAsked={refreshReviewBox}
      />

      {/* Composer */}
      {banned ? (
        <p className="border-t border-line bg-danger-soft p-4 text-center font-semibold text-danger">
          Профилът ви е блокиран и не можете да пишете.
        </p>
      ) : (
        <form onSubmit={submit} className="safe-bottom @container relative bg-surface px-3 pt-2 sm:px-4">
          {!iAmClient && craftsmanId === me && (
            <QuickReplies
              me={me}
              current={text}
              onPick={(t) => {
                setText(t);
                box.current?.focus();
              }}
            />
          )}
          <AttachmentStrip items={attachments} onRemove={removeAttachment} busy={sending} />
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <AttachButton onPick={pickFiles} disabled={sending || attachments.length >= MAX_ATTACHMENTS} />
            {canBook && iAmClient && (
              <button
                type="button"
                className="btn btn-outline size-11 shrink-0 p-0 @lg:w-auto @lg:px-3"
                onClick={() => setSheet(true)}
                aria-label="Предложи час"
                title="Предложи ден и час за оглед или работа"
              >
                <CalendarPlus className="size-5" aria-hidden />
                {/* By the composer's own width: the chat dock is narrow even on a wide screen */}
                <span className="hidden @lg:inline">Уговорка</span>
              </button>
            )}
            {canBook && !iAmClient && (
              <Menu
                label="Предложи уговорка или оферта"
                placement="up-left"
                width="w-64"
                triggerClass="btn btn-outline size-11 p-0 @lg:w-auto @lg:px-3"
                trigger={(open) => (
                  <>
                    <Handshake className="size-5" aria-hidden />
                    <span className="hidden @lg:inline">Предложи</span>
                    <ChevronUp className={`hidden size-4 transition-transform @lg:inline ${open ? "" : "rotate-180"}`} aria-hidden />
                  </>
                )}
                items={[
                  {
                    label: "Уговорка",
                    hint: "Ден и час в календара ти",
                    icon: <CalendarPlus className="mt-0.5 size-5 shrink-0" aria-hidden />,
                    onSelect: () => setSheet(true),
                  },
                  canOffer
                    ? {
                        label: "Оферта",
                        hint: "Цена и срок, които клиентът приема с клик",
                        icon: <BadgeEuro className="mt-0.5 size-5 shrink-0" aria-hidden />,
                        onSelect: () => setOfferOpen(true),
                      }
                    : {
                        label: "Оферта (Pro)",
                        hint: "Офертите са в плана Pro",
                        icon: <BadgeEuro className="mt-0.5 size-5 shrink-0" aria-hidden />,
                        href: "/tabla/plan",
                      },
                ]}
              />
            )}
            <label htmlFor="msg" className="sr-only">
              Съобщение
            </label>
            <textarea
              id="msg"
              ref={box}
              rows={1}
              maxLength={4000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && enterSends()) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Съобщение…"
              className="field max-h-40 min-h-11 resize-none py-2.5"
              enterKeyHint="enter"
            />
            <button type="submit" className="btn btn-rule size-11 shrink-0 p-0" disabled={(!text.trim() && attachments.length === 0) || sending} aria-label="Изпрати">
              <SendHorizontal className="size-5" aria-hidden />
            </button>
          </div>
          <p className="mx-auto mt-1 hidden max-w-2xl text-xs text-ink-3 md:block">
            Enter изпраща, Shift+Enter за нов ред. Когато се разберете, натиснете {iAmClient ? "„Уговорка“" : "„Предложи“"}.
          </p>
        </form>
      )}
      {!banned && canOffer && !iAmClient && craftsmanId === me && (
        <OfferSheet open={offerOpen} onClose={() => setOfferOpen(false)} craftsmanId={me} partnerName={partner.name} onCreated={sendOffer} />
      )}
      {!banned && canBook && craftsmanId && (
        <BookingSheet
          open={sheet}
          onClose={() => setSheet(false)}
          conversationId={conversationId}
          craftsmanId={craftsmanId}
          iAmCraftsman={!iAmClient}
          craftsmanSameDay={craftsmanSameDay}
          partnerName={partner.name}
          defaultDate={requestedDate}
          onCreated={refreshBookings}
        />
      )}
    </section>
  );
}

/** Company conversations: the manager picks who takes over; the assigned craftsman sees that it was handed to him. */
function AssignBar({
  conversationId,
  org,
  me,
}: {
  conversationId: string;
  org: NonNullable<Props["org"]>;
  me: string;
}) {
  const supabase = createClient();
  const [value, setValue] = useState(org.assignedTo ?? "");
  const [pending, setPending] = useState(false);

  async function assign() {
    setPending(true);
    const { error } = await supabase.rpc("assign_org_conversation", { p_conversation: conversationId, p_craftsman: (value || null) as unknown as string });
    setPending(false);
    if (error) toast.error(error.message);
    else toast.success(value ? "Разговорът е възложен." : "Разговорът е върнат към фирмата.");
  }

  if (!org.canAssign) {
    return org.assignedTo === me ? (
      <p className="border-b border-line bg-rule-soft px-4 py-2 text-sm font-semibold">Фирмата „{org.name}“ ти възложи този разговор.</p>
    ) : null;
  }
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line bg-rule-soft px-4 py-2 text-sm">
      <span className="font-semibold">Разговор с клиент до {org.name}. Възложен на:</span>
      <select className="field min-h-9 w-auto py-1 text-sm" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Майстор">
        <option value="">Никого (при фирмата)</option>
        {org.team.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <button type="button" className="btn btn-primary btn-sm" disabled={pending || value === (org.assignedTo ?? "")} onClick={assign}>
        Запази
      </button>
    </div>
  );
}
