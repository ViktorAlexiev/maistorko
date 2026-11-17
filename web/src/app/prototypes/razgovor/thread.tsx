"use client";

import { BadgeEuro, CalendarPlus, ChevronUp, Ellipsis, Flag, Handshake, ImagePlus, Phone, Star } from "lucide-react";
import { Avatar } from "@/components/avatar";
import type { BookingData, OfferData } from "./data";
import {
  askText,
  BackButton,
  BookingActions,
  callHref,
  ComposerField,
  Flash,
  Hint,
  isQuiet,
  KIND,
  Menu,
  QuickRow,
  RateDone,
  RateFields,
  Rivet,
  SendButton,
  statusOf,
  TextBubble,
  type Refs,
  type Room,
} from "./shared";

/** Draws an offer inside the conversation; `bg` is the card tone that fits the ground it lies on. */
export type OfferRender = (o: OfferData, bg: string) => React.ReactNode;

/** The „Тихо“ conversation: header, bar, bubbles, cards, review box, quick-reply row, composer. Everything is inline; tone and space separate the parts. */
export function Thread({
  r,
  scroller,
  box,
  offer,
  ground = "paper",
  bare = false,
  className = "",
}: Refs & {
  r: Room;
  offer: OfferRender;
  /** "paper": messages on Concrete Paper. "surface": the whole conversation is Card Surface (cards and incoming bubbles step back to paper). */
  ground?: "paper" | "surface";
  /** the header is drawn elsewhere (one top bar across list and conversation) */
  bare?: boolean;
  className?: string;
}) {
  const onSurface = ground === "surface";
  const card = onSurface ? "bg-paper" : "bg-surface";
  return (
    <section aria-label={`Разговор с ${r.partner.name}`} className={`relative flex min-h-0 flex-col ${onSurface ? "bg-surface" : "bg-paper"} ${className}`}>
      {!bare && <ThreadHeader r={r} />}
      {r.upcoming && <UpcomingBar r={r} />}
      <div
        data-proto="messages"
        ref={scroller}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-5"
      >
        <ol className="mx-auto grid max-w-2xl gap-1.5">
          {r.messages.map((m) => (
            <li key={m.id} id={`m-${m.id}`} className="grid">
              {m.t === "day" && <p className="numerals my-2 text-center text-base text-ink-3">{m.label}</p>}
              {m.t === "text" && <TextBubble m={m} r={r} incoming={card} />}
              {m.t === "booking" && <BookingCard r={r} id={m.id} b={m.b} bg={card} />}
              {m.t === "offer" && offer(m.o, card)}
              {m.t === "invite" && <InviteCard r={r} body={m.body} bg={card} />}
            </li>
          ))}
        </ol>
      </div>
      <ReviewField r={r} />
      <Composer r={r} box={box} />
    </section>
  );
}

export function ThreadHeader({ r }: { r: Room }) {
  return (
    <header className="relative z-20 flex items-center gap-2 bg-surface px-1.5 py-2 sm:px-3">
      <BackButton r={r} className="hover:bg-ink/5" />
      <div className="relative ml-1.5 shrink-0 md:ml-0">
        <Avatar name={r.partner.name} size={40} />
        <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-free ring-2 ring-surface" title="На линия" role="img" aria-label="На линия" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[1.125rem] font-extrabold leading-tight">{r.partner.name}</p>
        <p className="text-sm leading-snug text-ink-2">{r.about}</p>
      </div>
      <a href={callHref(r)} className="btn btn-ghost size-11 shrink-0 p-0" aria-label={`Обади се на ${r.partner.first}`} title={r.partner.phone}>
        <Phone className="size-5" aria-hidden />
      </a>
      <Menu
        label="Още действия"
        triggerClass="btn btn-ghost size-11 p-0"
        trigger={() => <Ellipsis className="size-5" aria-hidden />}
        items={[{ label: "Докладвай", hint: "Съобщи ни за проблем с този разговор", icon: <Flag className="mt-0.5 size-5 shrink-0" aria-hidden />, onSelect: () => r.flash("Проба: тук се отваря формата за докладване") }]}
      />
    </header>
  );
}

function UpcomingBar({ r }: { r: Room }) {
  const u = r.upcoming!;
  return (
    <div className="flex min-h-11 items-center gap-2.5 bg-rule-soft pl-4 pr-1.5">
      <Rivet kind="filled" />
      <p className="numerals min-w-0 flex-1 text-[1.1rem] leading-tight">
        {KIND[u.b.kind]} {u.b.rel ?? `в ${u.b.weekday}`} · {u.b.time}
      </p>
      <button type="button" className="min-h-11 px-3 text-sm font-bold text-ink-2 underline" onClick={() => r.scrollToCard(u.id)}>
        Виж
      </button>
    </div>
  );
}

function BookingCard({ r, id, b, bg }: { r: Room; id: string; b: BookingData; bg: string }) {
  const st = statusOf(b);
  const quiet = isQuiet(b);
  return (
    <div className={`mx-auto my-1.5 w-full max-w-md overflow-hidden rounded-[10px] ${quiet ? "bg-surface-2 text-ink-2" : bg}`}>
      <div aria-hidden className="graduations graduations-top h-2 bg-rule" />
      <div className="p-3.5 pt-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink-2">{KIND[b.kind]}</p>
            <p className={`numerals text-[1.4rem] leading-tight first-letter:uppercase ${b.status === "declined" || b.status === "cancelled" ? "line-through decoration-2" : ""}`}>
              {b.date}, {b.time}
            </p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 pt-0.5 text-sm font-bold">
            {st.rivet && <Rivet kind={st.rivet} />}
            {st.word}
          </span>
        </div>
        <BookingActions r={r} id={id} b={b} inner={bg === "bg-paper" ? "bg-surface-2" : "bg-paper"} />
      </div>
    </div>
  );
}

function InviteCard({ r, body, bg }: { r: Room; body: string; bg: string }) {
  return (
    <div className={`mx-auto my-1.5 w-full max-w-md rounded-[10px] p-3.5 ${bg}`}>
      <p className="flex items-center gap-1.5 text-sm font-bold text-ink-2">
        <Star className="size-4" aria-hidden /> Работата е свършена
      </p>
      <p className="mt-0.5">{body}</p>
      {r.viewer === "client" ? (
        r.rate.done ? (
          <p className="mt-2 text-sm font-semibold text-ink-2">Отзивът е публикуван.</p>
        ) : (
          <button type="button" className="btn btn-primary mt-2 w-full" onClick={r.rateOpen}>
            Остави отзив
          </button>
        )
      ) : (
        <p className="mt-2 text-sm text-ink-3">Клиентът може да остави отзив от този разговор.</p>
      )}
    </div>
  );
}

/** One compact Pale Rule Yellow field above the composer; the confirm step and the review form replace its content in place. */
function ReviewField({ r }: { r: Room }) {
  if (r.viewer === "client" && r.rate.done) return <RateDone className="mx-3 mb-2" />;
  if (r.showRateForm) {
    return (
      <div className="mx-3 mb-2 rounded-[10px] bg-rule-soft p-3">
        <p className="mb-1 flex items-center gap-2 font-bold">
          <Star className="size-5 shrink-0" aria-hidden /> Оцени {r.partner.first}
        </p>
        <RateFields r={r} idPrefix="tiho" />
      </div>
    );
  }
  if (r.showRate) {
    return (
      <div className="mx-3 mb-2 flex items-center gap-3 rounded-[10px] bg-rule-soft py-1.5 pl-3 pr-1.5">
        <Star className="size-5 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1 font-semibold leading-tight">Оцени {r.partner.first}</p>
        <button type="button" className="btn btn-primary btn-sm min-h-11" onClick={r.rateOpen}>
          Оцени
        </button>
      </div>
    );
  }
  if (!r.showAsk) return null;
  if (r.askStep === "confirm") {
    return (
      <div className="mx-3 mb-2 rounded-[10px] bg-rule-soft p-3" role="alertdialog" aria-label="Покана за отзив">
        <p className="leading-snug">{askText(r)}</p>
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn btn-primary" onClick={r.askSend}>
            Прати поканата
          </button>
          <button type="button" className="btn btn-outline" onClick={r.askCancel}>
            Не още
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-3 mb-2 flex items-center gap-3 rounded-[10px] bg-rule-soft py-1.5 pl-3 pr-1.5">
      <Star className="size-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 font-semibold leading-tight">Свърши ли работата?</p>
      <button type="button" className="btn btn-primary btn-sm min-h-11" onClick={r.askOpen}>
        Да, поискай отзив
      </button>
    </div>
  );
}

function Composer({ r, box }: { r: Room; box: Refs["box"] }) {
  const craftsman = r.viewer === "craftsman";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        r.submit();
      }}
      className="safe-bottom @container relative bg-surface px-3 pt-2 sm:px-4"
    >
      <Flash r={r} />
      {craftsman && (
        <div className="mx-auto mb-2 max-w-2xl">
          <QuickRow r={r} />
        </div>
      )}
      <div className="mx-auto flex max-w-2xl items-end gap-2">
        <button type="button" className="btn btn-outline size-11 shrink-0 p-0" aria-label="Прикачи снимка" title="Прикачи снимка" onClick={() => r.flash("Проба: снимките не се качват")}>
          <ImagePlus className="size-5" aria-hidden />
        </button>
        {craftsman ? (
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
              { label: "Уговорка", hint: "Ден и час в календара ти", icon: <CalendarPlus className="mt-0.5 size-5 shrink-0" aria-hidden />, onSelect: () => r.flash("Проба: тук се отваря листът за ден и час") },
              { label: "Оферта", hint: "Цена и срок, които клиентът приема с клик", icon: <BadgeEuro className="mt-0.5 size-5 shrink-0" aria-hidden />, onSelect: () => r.flash("Проба: тук се отваря офертата") },
            ]}
          />
        ) : (
          <button type="button" className="btn btn-outline size-11 shrink-0 p-0 @lg:w-auto @lg:px-3" aria-label="Предложи час" title="Предложи ден и час за оглед или работа" onClick={() => r.flash("Проба: тук се отваря листът за ден и час")}>
            <CalendarPlus className="size-5" aria-hidden />
            <span className="hidden @lg:inline">Уговорка</span>
          </button>
        )}
        <ComposerField r={r} box={box} id="tiho-msg" />
        <SendButton r={r} className="btn btn-rule" />
      </div>
      <Hint r={r} className="mx-auto mt-1 max-w-2xl" />
    </form>
  );
}
