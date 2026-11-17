"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeEuro, CalendarPlus, Ellipsis, Flag, ImagePlus, Phone, Plus, Star, X } from "lucide-react";
import { CATEGORY, PLACE, type BookingData } from "./data";
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

/** „Талон“: the header is a yellow band that also holds the coming visit, every extra action is in one tray behind „＋“, the review prompt is part of the flow. */
export function VariantTalon({ r, scroller, box }: Refs & { r: Room }) {
  const [tray, setTray] = useState(false);
  const trayRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLButtonElement>(null);

  // Esc and a tap outside close the tray
  useEffect(() => {
    if (!tray) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setTray(false);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!trayRef.current?.contains(t) && !plusRef.current?.contains(t)) setTray(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [tray]);

  return (
    <Stage r={r}>
      <section aria-label={`Разговор с ${r.partner.name}`} className="relative flex min-h-0 flex-col bg-paper md:overflow-hidden md:rounded-[10px]">
        <Header r={r} />
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
                {m.t === "day" && <p className="mx-auto my-2 rounded-[4px] bg-surface-2 px-2.5 py-0.5 text-center"><span className="numerals text-base text-ink-2">{m.label}</span></p>}
                {m.t === "text" && <TextBubble m={m} r={r} round="rounded-[10px]" />}
                {m.t === "booking" && <Strip r={r} id={m.id} b={m.b} />}
                {m.t === "offer" && <OfferStrip r={r} title={m.title} total={m.total} />}
                {m.t === "invite" && <InviteStrip r={r} body={m.body} />}
              </li>
            ))}
          </ol>
          <ReviewInFlow r={r} />
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            r.submit();
          }}
          className="safe-bottom relative bg-surface px-3 pt-2 sm:px-4"
        >
          <Flash r={r} />
          <Tray r={r} open={tray} close={() => setTray(false)} trayRef={trayRef} />
          <div className="mx-auto flex max-w-2xl items-end gap-2">
            <button
              ref={plusRef}
              type="button"
              className="btn btn-outline size-11 shrink-0 p-0"
              aria-label={tray ? "Затвори действията" : "Още действия: снимка, час, оферта, бързи отговори"}
              aria-expanded={tray}
              aria-controls="talon-tray"
              onClick={() => setTray((v) => !v)}
            >
              <Plus className={`size-6 transition-transform duration-200 ease-out motion-reduce:transition-none ${tray ? "rotate-45" : ""}`} aria-hidden />
            </button>
            <ComposerField r={r} box={box} id="talon-msg" />
            <SendButton r={r} />
          </div>
          <Hint r={r} className="mx-auto mt-1 max-w-2xl" />
        </form>
      </section>
    </Stage>
  );
}

function Header({ r }: { r: Room }) {
  const u = r.upcoming;
  return (
    <header className="relative z-20 bg-rule pb-2.5 pl-1.5 pr-1.5 pt-1.5 sm:pl-3 sm:pr-3">
      <div className="flex items-start gap-1">
        <BackButton r={r} className="hover:bg-ink/10" />
        <div className="min-w-0 flex-1 pl-1.5 pt-0.5 md:pl-0">
          <h2 className="display text-3xl">{r.partner.name}</h2>
          <p className="mt-0.5 flex items-center gap-2 text-sm font-semibold leading-snug">
            <span className="size-2.5 shrink-0 rounded-full bg-free ring-2 ring-ink/80" role="img" aria-label="На линия" title="На линия" />
            {CATEGORY} · {PLACE}
          </p>
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
      </div>
      {u && (
        <button type="button" className="mx-1.5 mt-1 flex min-h-11 items-center gap-2 text-left sm:mx-0" onClick={() => r.scrollToCard(u.id)} aria-label={`${KIND[u.b.kind]} ${u.b.rel ?? `в ${u.b.weekday}`}, ${u.b.time}. Покажи уговорката`}>
          <Rivet kind="filled" />
          <span className="numerals text-xl leading-none">
            {KIND[u.b.kind]} {u.b.rel ?? `в ${u.b.weekday}`}, {u.b.time}
          </span>
        </button>
      )}
    </header>
  );
}

/** A very compact strip: the status (rivet and word) in a narrow column at the left, the facts beside it. */
function Strip({ r, id, b }: { r: Room; id: string; b: BookingData }) {
  const st = statusOf(b);
  const quiet = isQuiet(b);
  return (
    <div className="mx-auto my-0.5 flex w-full max-w-md overflow-hidden rounded-[6px] bg-surface">
      <div className={`flex w-[5.5rem] shrink-0 flex-col items-center justify-center gap-1 px-1.5 py-2 text-center ${quiet ? "bg-surface-2 text-ink-2" : "bg-rule-soft"}`}>
        {st.rivet ? <Rivet kind={st.rivet} /> : <span aria-hidden className="size-3" />}
        <span className="text-xs font-bold leading-tight">{st.word}</span>
      </div>
      <div className={`min-w-0 flex-1 px-3 py-2 ${quiet ? "text-ink-2" : ""}`}>
        <p className="text-xs font-bold text-ink-2">{KIND[b.kind]}</p>
        <p className={`numerals text-lg leading-tight first-letter:uppercase ${b.status === "declined" || b.status === "cancelled" ? "line-through decoration-2" : ""}`}>
          {b.date}, {b.time}
        </p>
        <BookingActions r={r} id={id} b={b} />
      </div>
    </div>
  );
}

function OfferStrip({ r, title, total }: { r: Room; title: string; total: number }) {
  return (
    <div className="mx-auto my-0.5 flex w-full max-w-md overflow-hidden rounded-[6px] bg-surface">
      <div className="flex w-[5.5rem] shrink-0 flex-col items-center justify-center gap-1 bg-surface-2 px-1.5 py-2 text-center">
        <BadgeEuro className="size-5" aria-hidden />
        <span className="text-xs font-bold leading-tight">Оферта</span>
      </div>
      <div className="min-w-0 flex-1 px-3 py-2">
        <p className="font-bold leading-snug">{title}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p className="numerals whitespace-nowrap text-2xl leading-none">{total.toFixed(2).replace(".", ",")} €</p>
          <button type="button" className="btn btn-primary btn-sm min-h-11" onClick={() => r.flash("Проба: тук се отваря страницата на офертата")}>
            {r.viewer === "client" ? "Виж и приеми" : "Виж как я вижда клиентът"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InviteStrip({ r, body }: { r: Room; body: string }) {
  return (
    <div className="mx-auto my-0.5 flex w-full max-w-md overflow-hidden rounded-[6px] bg-surface">
      <div className="flex w-[5.5rem] shrink-0 flex-col items-center justify-center gap-1 bg-surface-2 px-1.5 py-2 text-center">
        <Star className="size-5" aria-hidden />
        <span className="text-xs font-bold leading-tight">Свършено</span>
      </div>
      <div className="min-w-0 flex-1 px-3 py-2">
        <p className="leading-snug">{body}</p>
        {r.viewer === "client" ? (
          r.rate.done ? (
            <p className="mt-1 text-sm font-semibold text-ink-2">Отзивът е публикуван.</p>
          ) : (
            <button type="button" className="btn btn-primary btn-sm mt-1.5 min-h-11" onClick={r.rateOpen}>
              Остави отзив
            </button>
          )
        ) : (
          <p className="mt-1 text-sm text-ink-3">Клиентът може да остави отзив от този разговор.</p>
        )}
      </div>
    </div>
  );
}

/** The review prompt is the last thing in the flow, not a fixed box; its confirm step and form open in place. */
function ReviewInFlow({ r }: { r: Room }) {
  if (r.viewer === "client" && r.rate.done) return <RateDone className="mx-auto mt-3 max-w-md" />;
  if (r.showRateForm) {
    return (
      <div className="mx-auto mt-3 max-w-md rounded-[10px] bg-surface p-3">
        <p className="mb-1 font-bold">Оцени {r.partner.first}</p>
        <RateFields r={r} idPrefix="talon" />
      </div>
    );
  }
  if (r.showRate) {
    return (
      <div className="mx-auto mt-3 grid max-w-md justify-items-center gap-1 text-center">
        <p className="text-sm text-ink-2">{r.passedLine} Свърши ли работата?</p>
        <button type="button" className="btn btn-outline" onClick={r.rateOpen}>
          Оцени {r.partner.first}
        </button>
      </div>
    );
  }
  if (!r.showAsk) return null;
  if (r.askStep === "confirm") {
    return (
      <div className="mx-auto mt-3 max-w-md rounded-[10px] bg-rule-soft p-3" role="alertdialog" aria-label="Покана за отзив">
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
    <div className="mx-auto mt-3 grid max-w-md justify-items-center gap-1 text-center">
      <p className="text-sm text-ink-2">{r.passedLine || "Огледът мина."} Свърши ли работата?</p>
      <button type="button" className="btn btn-outline" onClick={r.askOpen}>
        Поискай отзив
      </button>
    </div>
  );
}

/** Everything that is not a message: slides up above the composer (200ms, ease-out, transform and opacity only). */
function Tray({ r, open, close, trayRef }: { r: Room; open: boolean; close: () => void; trayRef: React.RefObject<HTMLDivElement | null> }) {
  const q = r.quick;
  const craftsman = r.viewer === "craftsman";
  const act = (fn: () => void) => () => {
    close();
    fn();
  };
  const tile = "flex min-h-20 flex-col items-center justify-center gap-1 rounded-[10px] bg-paper px-2 py-2 text-center font-bold hover:bg-surface-2";
  return (
    <div
      id="talon-tray"
      ref={trayRef}
      inert={!open}
      className={`absolute inset-x-0 bottom-full z-30 max-h-[60dvh] overflow-y-auto rounded-t-[14px] bg-surface px-3 pb-3 pt-3 shadow-[var(--shadow-lg)] transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none sm:px-4 ${open ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0"}`}
    >
      <div className="mx-auto max-w-2xl">
        <div className={`grid gap-2 ${craftsman ? "grid-cols-3" : "grid-cols-2"}`}>
          <button type="button" className={tile} onClick={act(() => r.flash("Проба: снимките не се качват"))}>
            <ImagePlus className="size-6" aria-hidden /> Снимка
          </button>
          <button type="button" className={tile} onClick={act(() => r.flash("Проба: тук се отваря листът за ден и час"))}>
            <CalendarPlus className="size-6" aria-hidden /> Предложи час
          </button>
          {craftsman && (
            <button type="button" className={tile} onClick={act(() => r.flash("Проба: тук се отваря офертата"))}>
              <BadgeEuro className="size-6" aria-hidden /> Оферта
            </button>
          )}
        </div>
        {craftsman && (
          <div className="mt-3">
            <div className="flex items-center justify-between">
              <h3 className="display text-[1.45rem]">Бързи отговори</h3>
              {q.own.length > 0 && (
                <button type="button" className="min-h-11 px-2 text-sm font-semibold text-ink-3 underline" onClick={q.toggleEdit}>
                  {q.edit ? "Готово" : "Промени"}
                </button>
              )}
            </div>
            <ul className="mt-1 grid gap-1">
              {q.defaults.map((t) => (
                <li key={t}>
                  <button type="button" className="flex min-h-11 w-full items-center rounded-[6px] bg-paper px-3 text-left font-semibold hover:bg-surface-2" onClick={act(() => q.pick(t))}>
                    {t}
                  </button>
                </li>
              ))}
              {q.own.map((o) => (
                <li key={o.id} className="flex gap-1">
                  <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center rounded-[6px] bg-rule-soft px-3 text-left font-semibold" onClick={act(() => q.pick(o.body))}>
                    {o.body}
                  </button>
                  {q.edit && (
                    <button type="button" className="grid size-11 shrink-0 place-items-center rounded-[6px] text-danger hover:bg-danger-soft" onClick={() => q.remove(o.id)} aria-label={`Изтрий „${o.body}“`}>
                      <X className="size-4" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
              <li>
                <button type="button" className="flex min-h-11 w-full items-center gap-2 rounded-[6px] px-3 text-left font-bold text-ink-2 hover:bg-paper" onClick={act(q.save)}>
                  <Plus className="size-4" aria-hidden /> Запази написаното
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
