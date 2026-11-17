"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BadgeEuro, CalendarCheck, CalendarClock, CalendarDays, CalendarPlus, CalendarX, Check, CheckCheck, ExternalLink, Minus, RotateCw, Search, SendHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/avatar";
import { useConfirm } from "@/components/confirm-dialog";
import { DateField, TimeField } from "@/components/date-time-fields";
import { formatDate, formatEur } from "@/lib/format";
import { SLOT_DEFS } from "@/lib/slots";
import { AttachButton, AttachmentStrip, MAX_ATTACHMENTS, PhotoTile, type Attachment } from "@/app/saobshtenia/[id]/chat-photos";
import type { BookingData, Msg, OfferData } from "../razgovor/data";
import { BUSY_DAYS, CRAFTSMAN, FIRST_TOKEN, TODAY, type SentData } from "./data";
import { useWindowRoom, type WindowRoom } from "./window";

/*
 * „Днес“: the conversation of the window the way the production window draws it today.
 * Copied from: src/components/chat-dock.tsx:95-150 (frame and header), :396-484 (DockThread → Thread embedded),
 * src/app/saobshtenia/[id]/thread.tsx:363-598 (strip, messages, bubbles, offer card) and :600-729 (composer),
 * src/app/saobshtenia/[id]/booking.tsx:34-129 (booking card) and :151-426 (the „Предложи час“ sheet).
 * Production components that read or write the database are not imported: they are redrawn here from the same JSX,
 * fed by the same Room as „Тихо“. PhotoTile, AttachButton and AttachmentStrip take only props and are the production ones.
 */

const KIND_LABEL = { inspection: "Оглед", work: "Работа" } as const;

const BOOKING_STATUS = {
  proposed: { label: "Чака потвърждение", cls: "bg-rule-soft text-ink" },
  confirmed: { label: "Уговорено", cls: "bg-free text-white" },
  declined: { label: "Отказано", cls: "bg-surface-2 text-ink-2" },
  cancelled: { label: "Отменено", cls: "bg-surface-2 text-ink-2" },
} as const;

const bookingWhen = (b: BookingData) => `${b.date}, ${b.time}`;

/** booking.tsx:34-129 */
function BookingCard({ r, id, b }: { r: WindowRoom; id: string; b: BookingData }) {
  const { confirm, dialog } = useConfirm();
  const mineProposal = b.by === "client";
  const st = BOOKING_STATUS[b.status];
  const Icon = b.status === "confirmed" ? CalendarCheck : b.status === "proposed" ? CalendarClock : CalendarX;

  const act = async (action: "confirm" | "decline" | "cancel", ask?: { title: string; message?: string }) => {
    if (ask && !(await confirm({ ...ask, confirmLabel: "Да, отмени", cancelLabel: "Не", danger: true }))) return;
    r.actBooking(id, action);
    toast.success(action === "confirm" ? "Уговорката е потвърдена и е в календара." : action === "decline" ? "Отказахте." : "Уговорката е отменена.");
  };

  return (
    <div
      className={`mx-auto my-2 w-full max-w-md overflow-hidden rounded-[10px] border-[1.5px] bg-surface ${
        b.status === "confirmed" ? "border-free" : b.status === "proposed" ? "border-ink" : "border-line"
      }`}
    >
      <div aria-hidden className="graduations graduations-top h-2 bg-rule" />
      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 size-6 shrink-0" strokeWidth={1.75} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink-2">{KIND_LABEL[b.kind]}</p>
            <p className={`text-lg font-extrabold first-letter:uppercase ${b.status === "cancelled" || b.status === "declined" ? "line-through decoration-2 opacity-60" : ""}`}>
              {bookingWhen(b)}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
        </div>

        {b.status === "proposed" && !mineProposal && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="btn bg-free text-white hover:bg-free/90" onClick={() => act("confirm")}>
              Потвърди
            </button>
            <button type="button" className="btn btn-outline" onClick={() => act("decline")}>
              Не мога
            </button>
          </div>
        )}
        {b.status === "proposed" && mineProposal && (
          <div className="mt-3 flex items-center justify-between gap-2 text-sm text-ink-2">
            <span>Чакаме отговор от {CRAFTSMAN.first}.</span>
            <button type="button" className="font-bold underline" onClick={() => act("cancel")}>
              Оттегли
            </button>
          </div>
        )}
        {b.status === "confirmed" && (
          <div className="mt-3 flex items-center justify-between gap-2 text-sm text-ink-2">
            <span>Часът е запазен в календара на майстора.</span>
            <button type="button" className="font-bold text-danger underline" onClick={() => act("cancel", { title: "Да отменя ли уговорката?", message: "Другата страна ще види съобщение." })}>
              Отмени
            </button>
          </div>
        )}
      </div>
      {dialog}
    </div>
  );
}

/** thread.tsx:449-459: the offer card (the link is the real page of an offer) */
function OfferCard({ o }: { o: OfferData }) {
  return (
    <div className="mx-auto my-2 w-full max-w-md rounded-[10px] border-[1.5px] border-ink bg-surface p-3.5">
      <p className="flex items-center gap-1.5 text-sm font-bold text-ink-2">
        <BadgeEuro className="size-4" aria-hidden /> Оферта
      </p>
      <p className="mt-0.5 font-bold">{o.title}</p>
      <p className="numerals text-3xl">{o.total.toFixed(2).replace(".", ",")} €</p>
      <a href={`/oferta/${o.token}`} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-3 w-full">
        Виж и приеми офертата
      </a>
    </div>
  );
}

/** One photo of a message; the demo ones carry the „Демо изображение“ label that DESIGN.md asks for. */
function Photo({ src, demo }: { src: string; demo: boolean }) {
  return (
    <div className="relative">
      <PhotoTile url={src} />
      {demo && <span className="pointer-events-none absolute inset-x-1 bottom-1 rounded-[4px] bg-ink/85 px-1 py-0.5 text-center text-[0.625rem] font-bold leading-tight text-white">Демо изображение</span>}
    </div>
  );
}

/** thread.tsx:515-565: a bubble of mine or of the craftsman */
function Bubble({ r, m }: { r: WindowRoom; m: Extract<Msg, { t: "text" }> }) {
  const mine = m.from === "client";
  const failed = m.state === "failed";
  return (
    <>
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[85%] rounded-[14px] px-3.5 py-2 sm:max-w-[75%] ${
            mine ? "rounded-br-[4px] bg-ink text-white" : "rounded-bl-[4px] bg-surface ring-1 ring-inset ring-line"
          } ${failed ? "opacity-70 ring-2 ring-danger" : ""}`}
        >
          {m.photos && m.photos.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {m.photos.map((src) => (
                <PhotoTile key={src} url={src} />
              ))}
            </div>
          )}
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
          <p className={`mt-0.5 flex items-center justify-end gap-1 text-[0.72rem] ${mine ? "text-white/60" : "text-ink-3"}`}>
            {m.time}
            {mine && (m.state === "sending" ? <Check className="size-3.5" aria-label="Изпраща се" /> : failed ? null : <CheckCheck className="size-3.5" aria-label="Изпратено" />)}
          </p>
        </div>
      </div>
      {failed && (
        <button type="button" onClick={() => r.retry(m.id)} className="mt-1 inline-flex items-center gap-1 justify-self-end text-sm font-bold text-danger">
          <RotateCw className="size-3.5" aria-hidden /> Не е изпратено. Опитай пак
        </button>
      )}
    </>
  );
}

/** The first message in today's bubble: the label of date and work, its photos and its text, one time, one „Изпратено“. */
function FirstMessage({ sent }: { sent: SentData }) {
  const datePart = sent.label && sent.slot ? sent.label.slice(0, -(sent.slot.length + 2)) : sent.label;
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[14px] rounded-br-[4px] bg-ink px-3.5 py-2 text-white sm:max-w-[75%]">
        {(sent.label || sent.work) && (
          <p className="mb-1.5 inline-flex flex-wrap items-center gap-x-1.5 rounded-[6px] bg-rule px-2 py-1 text-sm font-bold text-ink">
            {sent.label && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4 shrink-0" aria-hidden />
                <span>
                  {datePart}
                  {sent.slot && <span className="font-semibold">, {sent.slot}</span>}
                </span>
              </span>
            )}
            {sent.label && sent.work && <span aria-hidden>·</span>}
            {sent.work && (
              <span className="font-semibold">
                {sent.work}
                {sent.workPrice !== undefined && `, от ${formatEur(sent.workPrice)}`}
              </span>
            )}
          </p>
        )}
        {sent.photos.length > 0 && (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {sent.photos.map((p, i) => (
              <Photo key={`${p.src}-${i}`} src={p.src} demo={p.demo} />
            ))}
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">{sent.body}</p>
        <p className="mt-0.5 flex items-center justify-end gap-1 text-[0.72rem] text-white/60">
          {sent.time}
          <CheckCheck className="size-3.5" aria-label="Изпратено" />
        </p>
      </div>
    </div>
  );
}

const PRESETS = [
  { key: "day", label: "Цял ден", from: null, to: null },
  ...SLOT_DEFS.map((s) => ({
    key: s.key,
    label: s.label,
    from: s.key === "morning" ? "08:00" : s.key === "afternoon" ? "12:00" : "17:00",
    to: s.key === "morning" ? "12:00" : s.key === "afternoon" ? "17:00" : "20:00",
  })),
  { key: "custom", label: "Точни часове", from: "09:00", to: "11:00" },
] as const;

type PresetKey = (typeof PRESETS)[number]["key"];

/** booking.tsx:151-426: the „Предложи час“ sheet of a client, without the database (the visit goes into the same conversation). */
function ProposeSheet({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (b: Omit<BookingData, "status" | "past" | "by">) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<"inspection" | "work">("inspection");
  const [date, setDate] = useState("2026-11-19");
  const [preset, setPreset] = useState<PresetKey>("morning");
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("11:00");
  const [note, setNote] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const p = PRESETS.find((x) => x.key === preset)!;
  const startTime = preset === "custom" ? from : p.from;
  const endTime = preset === "custom" ? to : p.to;
  const multiDay = kind === "work" && preset === "day" && endDate !== "";
  const invalidEnd = multiDay && endDate <= date;
  const invalid = Boolean(startTime && endTime && endTime <= startTime) || invalidEnd || !date;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (invalid) return;
    const when = multiDay ? `${formatDate(date, true)} – ${formatDate(endDate, true)}` : formatDate(date, true);
    onSend({ kind, date: when, weekday: formatDate(date, true).split(",")[0], time: multiDay ? "цели дни" : startTime && endTime ? `${startTime}–${endTime}` : "цял ден", iso: date });
    toast.success(`Изпратено. ${CRAFTSMAN.first} трябва да потвърди.`);
    setNote("");
    setEndDate("");
    onClose();
  }

  return (
    <dialog ref={ref} className="sheet" aria-labelledby="bk-title" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <form onSubmit={submit} className="safe-bottom grid max-h-[88dvh] gap-4 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="bk-title" className="display text-4xl">
              Предложи час
            </h2>
            <p className="mt-1 text-sm text-ink-2">{CRAFTSMAN.first} ще потвърди и тогава часът става зает в календара му.</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current?.close()} aria-label="Затвори">
            <X className="size-6" aria-hidden />
          </button>
        </div>

        <fieldset>
          <legend className="label">Какво се уговаряте?</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["inspection", "work"] as const).map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
                {k === "inspection" ? (
                  <>
                    <Search className="size-4" aria-hidden /> Оглед
                  </>
                ) : (
                  "Работа"
                )}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="bk-date" className="label">
            Ден
          </label>
          <DateField id="bk-date" min={TODAY} value={date} onChange={setDate} required />
          {BUSY_DAYS.includes(date) && <p className="hint">Този ден е отбелязан като зает. Може да се уговорите все пак.</p>}
        </div>

        <fieldset>
          <legend className="label">Час</legend>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((x) => (
              <button key={x.key} type="button" className="chip" aria-pressed={preset === x.key} onClick={() => setPreset(x.key)}>
                {x.label}
                {x.from && x.key !== "custom" && (
                  <span className="text-xs font-medium opacity-75">
                    {x.from.slice(0, 2)}–{x.to!.slice(0, 2)}
                  </span>
                )}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="bk-from" className="text-sm font-semibold text-ink-2">
                  От
                </label>
                <TimeField id="bk-from" className="field mt-1" value={from} onChange={setFrom} ariaLabel="От" />
              </div>
              <div>
                <label htmlFor="bk-to" className="text-sm font-semibold text-ink-2">
                  До
                </label>
                <TimeField id="bk-to" className="field mt-1" value={to} onChange={setTo} invalid={invalid} ariaLabel="До" />
              </div>
            </div>
          )}
          {Boolean(startTime && endTime && endTime <= startTime) && <p className="error-text">Краят трябва да е след началото.</p>}
        </fieldset>

        {kind === "work" && preset === "day" && (
          <div>
            <label htmlFor="bk-end" className="label">
              До ден <span className="font-normal text-ink-3">(ако работата е за няколко дни)</span>
            </label>
            <DateField id="bk-end" min={date} value={endDate} onChange={setEndDate} invalid={invalidEnd} />
            {invalidEnd ? <p className="error-text">Крайният ден трябва да е след първия.</p> : <p className="hint">Всички тези дни стават заети в календара. Оставете празно за един ден.</p>}
          </div>
        )}

        <div>
          <label htmlFor="bk-note" className="label">
            Бележка <span className="font-normal text-ink-3">(по желание)</span>
          </label>
          <input
            id="bk-note"
            className="field"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={kind === "inspection" ? "напр. ул. Родопи 12, ет. 4, звънец Иванови" : "напр. нося материалите"}
          />
        </div>

        <button type="submit" className="btn btn-primary btn-lg" disabled={invalid}>
          Изпрати предложение
        </button>
      </form>
    </dialog>
  );
}

type Item = { m: Msg; day?: string };

/** The window of today, with the conversation in it (chat-dock.tsx:95-150 and Thread embedded). */
export function DnesWindow({
  open,
  collapsed,
  onToggle,
  onClose,
  sent,
  extended,
}: {
  open: boolean;
  collapsed: boolean;
  onToggle: () => void;
  onClose: () => void;
  sent: SentData;
  extended: boolean;
}) {
  const box = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const r = useWindowRoom(box, sent, extended);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [sheet, setSheet] = useState(false);
  const urls = useRef<string[]>([]);

  useEffect(() => {
    const u = urls.current;
    return () => u.forEach((x) => URL.revokeObjectURL(x));
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [r.messages]);

  // The composer grows with its text, including the reset after sending
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + el.offsetHeight - el.clientHeight, 160)}px`;
  }, [r.text]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const body = r.text.trim();
    if ((!body && attachments.length === 0) || body.length > 4000) return;
    atBottom.current = true;
    if (attachments.length === 0) return r.submit();
    const n = attachments.length;
    r.sendWithPhotos(body || (n === 1 ? "📷 Снимка" : `📷 Снимки (${n})`), attachments.map((a) => a.preview));
    setAttachments([]);
  }

  function pickFiles(files: File[]) {
    const room = MAX_ATTACHMENTS - attachments.length;
    if (files.length > room) toast.message(`Най-много ${MAX_ATTACHMENTS} снимки наведнъж.`);
    setAttachments((xs) => [
      ...xs,
      ...files.slice(0, Math.max(room, 0)).map((file) => {
        const preview = URL.createObjectURL(file);
        urls.current.push(preview);
        return { key: `a${urls.current.length}`, file, preview };
      }),
    ]);
  }

  function removeAttachment(key: string) {
    setAttachments((xs) => xs.filter((a) => a.key !== key));
  }

  // a day divider belongs to the message that follows it, as in the thread
  const items: Item[] = [];
  let day: string | undefined;
  for (const m of r.messages) {
    if (m.t === "day") day = m.label === "днес" ? "Днес" : m.label;
    else {
      items.push({ m, day });
      day = undefined;
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={`Чат с ${CRAFTSMAN.name}`}
      onKeyDown={(e) => e.key === "Escape" && !document.querySelector("dialog[open]") && onClose()}
      className={`dock-in fixed z-50 flex-col overflow-hidden border-line-strong bg-paper shadow-[var(--shadow-lg)] sm:bottom-0 sm:right-6 sm:w-[25rem] sm:rounded-t-[12px] sm:border sm:border-b-0 ${
        collapsed ? "max-sm:inset-x-0 max-sm:bottom-0" : "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-11 sm:h-[min(38rem,calc(100dvh-5rem))]"
      } ${open ? "flex" : "hidden"}`}
    >
      <header className="flex shrink-0 items-center gap-2.5 bg-ink px-3 py-2 text-white">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={onToggle} aria-expanded={!collapsed} aria-label={collapsed ? "Разгъни чата" : "Свий чата"}>
          <Avatar name={CRAFTSMAN.name} size={34} />
          <span className="min-w-0">
            <span className="block truncate font-extrabold">{CRAFTSMAN.name}</span>
            <span className="block truncate text-xs text-[#bdb8aa]">Разговор</span>
          </span>
        </button>
        <Link href="/prototypes/razgovor?s=3" className="grid size-9 place-items-center rounded-[8px] hover:bg-white/10" aria-label="Отвори в „Съобщения“" title="Отвори в „Съобщения“">
          <ExternalLink className="size-4" aria-hidden />
        </Link>
        <button type="button" className="hidden size-9 place-items-center rounded-[8px] hover:bg-white/10 sm:grid" onClick={onToggle} aria-label={collapsed ? "Разгъни" : "Свий"}>
          <Minus className="size-4" aria-hidden />
        </button>
        <button type="button" className="grid size-9 place-items-center rounded-[8px] hover:bg-white/10" onClick={onClose} aria-label="Затвори чата">
          <X className="size-5" aria-hidden />
        </button>
      </header>

      {/* hidden, not unmounted: what was typed and the photos picked survive a collapse */}
      <div className={collapsed ? "hidden" : "flex min-h-0 flex-1 flex-col"}>
        <div className="flex min-h-0 flex-1 flex-col [&>section]:flex-1">
          <section aria-label={`Разговор с ${CRAFTSMAN.name}`} className="flex min-h-0 flex-col bg-paper">
            {r.upcoming && (
              <p className="flex items-center gap-2 border-b border-free/30 bg-free-soft px-4 py-2 text-sm font-semibold text-free">
                <CalendarCheck className="size-4 shrink-0" aria-hidden />
                <span className="first-letter:uppercase">
                  {KIND_LABEL[r.upcoming.b.kind]}: {bookingWhen(r.upcoming.b)}
                </span>
              </p>
            )}

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
                {items.map(({ m, day: d }) => (
                  <li key={m.id} className="msg grid">
                    {d && <p className="my-3 text-center text-xs font-bold uppercase tracking-wide text-ink-3">{d}</p>}
                    {m.t === "offer" ? (
                      m.o.token === FIRST_TOKEN ? (
                        <FirstMessage sent={sent} />
                      ) : (
                        <OfferCard o={m.o} />
                      )
                    ) : m.t === "booking" ? (
                      <BookingCard r={r} id={m.id} b={m.b} />
                    ) : m.t === "text" ? (
                      <Bubble r={r} m={m} />
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>

            <form onSubmit={submit} className="safe-bottom @container border-t border-line bg-surface px-3 pt-3 sm:px-4">
              <AttachmentStrip items={attachments} onRemove={removeAttachment} busy={false} />
              <div className="mx-auto flex max-w-2xl items-end gap-2">
                <AttachButton onPick={pickFiles} disabled={attachments.length >= MAX_ATTACHMENTS} />
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
                <label htmlFor="msg" className="sr-only">
                  Съобщение
                </label>
                <textarea
                  id="msg"
                  ref={box}
                  rows={1}
                  maxLength={4000}
                  value={r.text}
                  onChange={(e) => r.setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                  placeholder="Съобщение…"
                  className="field max-h-40 min-h-11 resize-none py-2.5"
                  enterKeyHint="send"
                />
                <button type="submit" className="btn btn-primary size-11 shrink-0 p-0" disabled={!r.text.trim() && attachments.length === 0} aria-label="Изпрати">
                  <SendHorizontal className="size-5" aria-hidden />
                </button>
              </div>
              <p className="mx-auto mt-1 hidden max-w-2xl text-xs text-ink-3 sm:block">Enter изпраща, Shift+Enter за нов ред. Когато се разберете, натиснете „Уговорка“.</p>
            </form>
            <ProposeSheet open={sheet} onClose={() => setSheet(false)} onSend={r.propose} />
          </section>
        </div>
      </div>
    </div>
  );
}
