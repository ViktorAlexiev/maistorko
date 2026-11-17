"use client";

import { BadgeEuro, CalendarPlus, Ellipsis, Flag, Handshake, ImagePlus, Phone, Star } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { aboutLine, type BookingData } from "./data";
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
  Stage,
  statusOf,
  TextBubble,
  type Refs,
  type Room,
} from "./shared";

const ON_DARK = "grid size-11 shrink-0 place-items-center rounded-[8px] text-white hover:bg-white/10";

/** „Прозорец“: the look of the chat window on a profile (graphite header, grey ground, square buttons) carried to the full page, without its lines. */
export function VariantProzorets({ r, scroller, box }: Refs & { r: Room }) {
  return (
    <Stage r={r}>
      <section aria-label={`Разговор с ${r.partner.name}`} className="relative flex min-h-0 flex-col bg-paper md:overflow-hidden md:rounded-[10px]">
        <Header r={r} />
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
                {m.t === "text" && <TextBubble m={m} r={r} />}
                {m.t === "booking" && <BookingCard r={r} id={m.id} b={m.b} />}
                {m.t === "offer" && <OfferCard r={r} title={m.title} total={m.total} />}
                {m.t === "invite" && <InviteCard r={r} body={m.body} />}
              </li>
            ))}
          </ol>
        </div>
        <ReviewBox r={r} />
        <Composer r={r} box={box} />
      </section>
    </Stage>
  );
}

function Header({ r }: { r: Room }) {
  return (
    <header className="relative z-20 flex items-center gap-1.5 bg-graphite px-1.5 py-2 text-white sm:px-3">
      <BackButton r={r} className="text-white hover:bg-white/10" />
      <div className="relative ml-1 shrink-0 md:ml-0">
        <Avatar name={r.partner.name} size={38} />
        <span className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-free ring-2 ring-graphite" role="img" aria-label="На линия" title="На линия" />
      </div>
      <div className="min-w-0 flex-1 pl-1">
        <p className="font-extrabold leading-tight">{r.partner.name}</p>
        <p className="text-xs leading-snug text-[#bdb8aa]">{aboutLine(r.scenario)}</p>
      </div>
      <a href={callHref(r)} className={ON_DARK} aria-label={`Обади се на ${r.partner.first}`} title={r.partner.phone}>
        <Phone className="size-5" aria-hidden />
      </a>
      <Menu
        label="Още действия"
        triggerClass={ON_DARK}
        trigger={() => <Ellipsis className="size-5" aria-hidden />}
        items={[{ label: "Докладвай", hint: "Съобщи ни за проблем с този разговор", icon: <Flag className="mt-0.5 size-5 shrink-0" aria-hidden />, onSelect: () => r.flash("Проба: тук се отваря формата за докладване") }]}
      />
    </header>
  );
}

function UpcomingBar({ r }: { r: Room }) {
  const u = r.upcoming!;
  return (
    <div className="flex min-h-11 items-center gap-2.5 bg-rule pl-4 pr-1.5">
      <Rivet kind="filled" />
      <p className="numerals min-w-0 flex-1 text-[1.1rem] leading-tight">
        {KIND[u.b.kind]} {u.b.rel ?? `в ${u.b.weekday}`} · {u.b.time}
      </p>
      <button type="button" className="min-h-11 px-3 text-sm font-bold underline" onClick={() => r.scrollToCard(u.id)}>
        Виж
      </button>
    </div>
  );
}

/** A card with its own small graphite head, like the window above it: kind on the left, status on the right. */
function BookingCard({ r, id, b }: { r: Room; id: string; b: BookingData }) {
  const st = statusOf(b);
  const quiet = isQuiet(b);
  return (
    <div className={`mx-auto my-1.5 w-full max-w-md overflow-hidden rounded-[10px] ${quiet ? "bg-surface-2" : "bg-surface"}`}>
      <div className="flex items-center justify-between gap-2 bg-graphite px-3 py-1.5 text-white">
        <span className="text-sm font-bold">{KIND[b.kind]}</span>
        <span className="flex items-center gap-1.5 text-sm font-bold">
          {st.rivet && <Rivet kind={st.rivet} light />}
          {st.word}
        </span>
      </div>
      <div className={`p-3 ${quiet ? "text-ink-2" : ""}`}>
        <p className={`numerals text-[1.4rem] leading-tight first-letter:uppercase ${b.status === "declined" || b.status === "cancelled" ? "line-through decoration-2" : ""}`}>
          {b.date}, {b.time}
        </p>
        <BookingActions r={r} id={id} b={b} />
      </div>
    </div>
  );
}

function OfferCard({ r, title, total }: { r: Room; title: string; total: number }) {
  return (
    <div className="mx-auto my-1.5 w-full max-w-md overflow-hidden rounded-[10px] bg-surface">
      <div className="flex items-center gap-1.5 bg-graphite px-3 py-1.5 text-sm font-bold text-white">
        <BadgeEuro className="size-4" aria-hidden /> Оферта
      </div>
      <div className="p-3">
        <p className="font-bold">{title}</p>
        <p className="numerals text-3xl">{total.toFixed(2).replace(".", ",")} €</p>
        <button type="button" className="btn btn-primary mt-2 w-full" onClick={() => r.flash("Проба: тук се отваря страницата на офертата")}>
          {r.viewer === "client" ? "Виж и приеми офертата" : "Виж как я вижда клиентът"}
        </button>
      </div>
    </div>
  );
}

function InviteCard({ r, body }: { r: Room; body: string }) {
  return (
    <div className="mx-auto my-1.5 w-full max-w-md overflow-hidden rounded-[10px] bg-surface">
      <div className="flex items-center gap-1.5 bg-graphite px-3 py-1.5 text-sm font-bold text-white">
        <Star className="size-4" aria-hidden /> Работата е свършена
      </div>
      <div className="p-3">
        <p>{body}</p>
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
    </div>
  );
}

/** A graphite field with a yellow button above the composer, like the header: it belongs to the same dark look. */
function ReviewBox({ r }: { r: Room }) {
  if (r.viewer === "client" && r.rate.done) return <RateDone className="mx-3 mb-2" />;
  if (r.showRateForm) {
    return (
      <div className="mx-3 mb-2 rounded-[10px] bg-surface p-3">
        <p className="mb-1 flex items-center gap-2 font-bold">
          <Star className="size-5 shrink-0" aria-hidden /> Оцени {r.partner.first}
        </p>
        <RateFields r={r} idPrefix="prozorets" />
      </div>
    );
  }
  if (r.showRate) {
    return (
      <div className="mx-3 mb-2 flex items-center gap-3 rounded-[10px] bg-graphite py-1.5 pl-3 pr-1.5 text-white">
        <Star className="size-5 shrink-0 text-rule" aria-hidden />
        <p className="min-w-0 flex-1 font-semibold leading-tight">Оцени {r.partner.first}</p>
        <button type="button" className="btn btn-rule btn-sm min-h-11" onClick={r.rateOpen}>
          Оцени
        </button>
      </div>
    );
  }
  if (!r.showAsk) return null;
  if (r.askStep === "confirm") {
    return (
      <div className="mx-3 mb-2 rounded-[10px] bg-graphite p-3 text-white" role="alertdialog" aria-label="Покана за отзив">
        <p className="leading-snug">{askText(r)}</p>
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn btn-rule" onClick={r.askSend}>
            Прати поканата
          </button>
          <button type="button" className="btn btn-ghost text-white hover:!bg-white/10" onClick={r.askCancel}>
            Не още
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-3 mb-2 flex items-center gap-3 rounded-[10px] bg-graphite py-1.5 pl-3 pr-1.5 text-white">
      <Star className="size-5 shrink-0 text-rule" aria-hidden />
      <p className="min-w-0 flex-1 font-semibold leading-tight">Свърши ли работата?</p>
      <button type="button" className="btn btn-rule btn-sm min-h-11" onClick={r.askOpen}>
        Да, поискай отзив
      </button>
    </div>
  );
}

function Composer({ r, box }: { r: Room; box: Refs["box"] }) {
  const craftsman = r.viewer === "craftsman";
  const square = "btn btn-outline size-11 shrink-0 rounded-[6px] p-0";
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        r.submit();
      }}
      className="safe-bottom relative bg-surface px-3 pt-2 sm:px-4"
    >
      <Flash r={r} />
      {craftsman && (
        <div className="mx-auto mb-2 max-w-2xl">
          <QuickRow r={r} />
        </div>
      )}
      <div className="mx-auto flex max-w-2xl items-end gap-2">
        <button type="button" className={square} aria-label="Прикачи снимка" title="Прикачи снимка" onClick={() => r.flash("Проба: снимките не се качват")}>
          <ImagePlus className="size-5" aria-hidden />
        </button>
        {craftsman ? (
          <Menu
            label="Предложи уговорка или оферта"
            placement="up-left"
            width="w-64"
            triggerClass={square}
            trigger={() => <Handshake className="size-5" aria-hidden />}
            items={[
              { label: "Уговорка", hint: "Ден и час в календара ти", icon: <CalendarPlus className="mt-0.5 size-5 shrink-0" aria-hidden />, onSelect: () => r.flash("Проба: тук се отваря листът за ден и час") },
              { label: "Оферта", hint: "Цена и срок, които клиентът приема с клик", icon: <BadgeEuro className="mt-0.5 size-5 shrink-0" aria-hidden />, onSelect: () => r.flash("Проба: тук се отваря офертата") },
            ]}
          />
        ) : (
          <button type="button" className={square} aria-label="Уговорка: предложи час" title="Уговорка: ден и час за оглед или работа" onClick={() => r.flash("Проба: тук се отваря листът за ден и час")}>
            <CalendarPlus className="size-5" aria-hidden />
          </button>
        )}
        <ComposerField r={r} box={box} id="prozorets-msg" />
        <SendButton r={r} className="btn btn-primary rounded-[6px]" />
      </div>
      <Hint r={r} className="mx-auto mt-1 max-w-2xl" />
    </form>
  );
}
