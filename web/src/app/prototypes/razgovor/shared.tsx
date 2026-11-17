"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, CalendarDays, Check, CheckCheck, Plus, RotateCw, SendHorizontal, Star, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import {
  buildMessages,
  INVITE_BODY,
  PEOPLE,
  PHOTOS,
  QUICK_DEFAULTS,
  QUICK_OWN,
  SCENARIOS,
  type BookingData,
  type Msg,
  type Role,
  type Scenario,
} from "./data";

/* ------------------------------------------------------------------ state shared by all three variants */

const nowTime = () => new Date().toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });

/** Enter sends on a desktop; on a touch screen or a narrow window it makes a new line and only the arrow sends. */
const enterSends = () => typeof window !== "undefined" && !window.matchMedia("(pointer: coarse), (max-width: 767px)").matches;

export type Refs = { scroller: React.RefObject<HTMLDivElement | null>; box: React.RefObject<HTMLTextAreaElement | null> };

export type RateState = { open: boolean; rating: number; text: string; done: boolean; error: string };

/** The whole local state of one conversation: messages, composer, quick replies, bookings and both review flows. */
export function useRoom(scenario: Scenario, box: React.RefObject<HTMLTextAreaElement | null>) {
  const viewer = SCENARIOS[scenario - 1].viewer;
  const partnerRole: Role = viewer === "craftsman" ? "client" : "craftsman";
  const partner = PEOPLE[partnerRole];
  const [messages, setMessages] = useState<Msg[]>(() => buildMessages(scenario));
  const [text, setText] = useState("");
  const [own, setOwn] = useState(QUICK_OWN);
  const [editQuick, setEditQuick] = useState(false);
  const [askStep, setAskStep] = useState<"idle" | "confirm">("idle");
  const [rate, setRate] = useState<RateState>({ open: false, rating: 0, text: "", done: false, error: "" });
  const [cancelAsk, setCancelAsk] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const seq = useRef(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const bookings = messages.flatMap((m) => (m.t === "booking" ? [{ id: m.id, b: m.b }] : []));
  const upcoming = bookings.filter((x) => x.b.status === "confirmed" && !x.b.past).sort((a, c) => a.b.iso.localeCompare(c.b.iso))[0] ?? null;
  const hasOpenBooking = upcoming !== null || bookings.some((x) => x.b.status === "proposed");
  const invited = messages.some((m) => m.t === "invite");
  const passed = [...bookings].reverse().find((x) => x.b.status === "confirmed" && x.b.past)?.b ?? null;
  const passedLine = passed ? `${passed.kind === "inspection" ? "Огледът" : "Работата"} мина в ${passed.weekday}.` : "";
  /** craftsman: „Свърши ли работата?“ only when nothing is coming up and no invite was sent yet */
  const showAsk = viewer === "craftsman" && !hasOpenBooking && !invited;
  /** client: „Оцени“ only after the visit passed, until a review or an invite card exists */
  const showRate = viewer === "client" && passed !== null && !rate.done && !invited && !rate.open;
  const showRateForm = viewer === "client" && rate.open && !rate.done;

  function flash(t: string) {
    setNote(t);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setNote(null), 2600);
  }

  function settle(id: string) {
    setTimeout(() => setMessages((xs) => xs.map((x) => (x.t === "text" && x.id === id ? { ...x, state: "sent" } : x))), 600);
  }

  function push(body: string) {
    const id = `n${++seq.current}`;
    setMessages((xs) => [...xs, { t: "text", id, from: viewer, body, time: nowTime(), state: "sending" }]);
    settle(id);
  }

  function submit() {
    const body = text.trim();
    if (!body) return;
    setText("");
    push(body);
    box.current?.focus();
  }

  function retry(id: string) {
    setMessages((xs) => xs.map((x) => (x.t === "text" && x.id === id ? { ...x, state: "sending" } : x)));
    settle(id);
  }

  function patchBooking(id: string, patch: Partial<BookingData>) {
    setMessages((xs) => xs.map((x) => (x.t === "booking" && x.id === id ? { ...x, b: { ...x.b, ...patch } } : x)));
  }

  function actBooking(id: string, action: "confirm" | "decline" | "cancel") {
    setCancelAsk(null);
    patchBooking(id, { status: action === "confirm" ? "confirmed" : action === "decline" ? "declined" : "cancelled" });
  }

  function sendInvite() {
    setMessages((xs) => [...xs, { t: "invite", id: `n${++seq.current}`, time: nowTime(), body: INVITE_BODY }]);
    setAskStep("idle");
  }

  function publish() {
    if (rate.rating === 0) return setRate((x) => ({ ...x, error: "Изберете оценка от една до пет звезди." }));
    setRate((x) => ({ ...x, open: false, done: true, error: "" }));
  }

  function scrollToCard(id: string) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`m-${id}`)?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }

  return {
    scenario,
    viewer,
    partner,
    messages,
    upcoming,
    passedLine,
    showAsk,
    showRate,
    showRateForm,
    invited,
    text,
    setText,
    note,
    flash,
    submit,
    retry,
    cancelAsk,
    setCancelAsk,
    actBooking,
    scrollToCard,
    askStep,
    askOpen: () => setAskStep("confirm"),
    askCancel: () => setAskStep("idle"),
    askSend: sendInvite,
    rate,
    rateOpen: () => setRate((x) => ({ ...x, open: true, error: "" })),
    rateClose: () => setRate((x) => ({ ...x, open: false, error: "" })),
    rateSet: (patch: Partial<RateState>) => setRate((x) => ({ ...x, ...patch, error: "" })),
    publish,
    quick: {
      defaults: QUICK_DEFAULTS,
      own,
      edit: editQuick,
      toggleEdit: () => setEditQuick((v) => !v),
      pick: (t: string) => {
        setText(t);
        box.current?.focus();
      },
      save: () => {
        const body = text.trim();
        if (!body) return flash("Напиши текст в полето и после го запази като бърз отговор.");
        setOwn((x) => [...x, { id: `own-n${++seq.current}`, body }]);
        flash("Запазено като бърз отговор.");
      },
      remove: (id: string) => setOwn((x) => x.filter((r) => r.id !== id)),
    },
  };
}

export type Room = ReturnType<typeof useRoom>;

/* ------------------------------------------------------------------ the page around the thread */

const SIDEBAR: Record<Role, { name: string; preview: string; when: string; about: string; unread?: boolean }[]> = {
  craftsman: [
    { name: "Мария Иванова", preview: "", when: "днес", about: "Осветление" },
    { name: "Стоян Колев", preview: "Може ли във вторник сутринта?", when: "вчера", about: "Контакти и ключове", unread: true },
    { name: "Десислава Тодорова", preview: "Благодаря, всичко работи.", when: "пн", about: "Електрическо табло" },
    { name: "Николай Попов", preview: "Вие: Ще мина в петък следобед.", when: "съб", about: "Видеонаблюдение" },
  ],
  client: [
    { name: "Георги Петров", preview: "", when: "днес", about: "Осветление" },
    { name: "Иван Димитров", preview: "Тръбата е сменена, ще ви пиша за сметката.", when: "вчера", about: "ВиК", unread: true },
    { name: "Недялко Стоянов", preview: "Вие: Удобно ми е в понеделник.", when: "пн", about: "Боядисване" },
  ],
};

const PREVIEW: Record<Scenario, string> = {
  1: "Вие: До утре в 9 ч. Ще ви звънна от входа.",
  2: "Благодаря! Ще помисля и ще ви пиша до утре.",
  3: "Вие: Благодаря! Ще помисля и ще ви пиша до утре.",
};

function Sidebar({ r }: { r: Room }) {
  return (
    <aside aria-label="Разговори" className="hidden min-h-0 flex-col md:flex">
      <h1 className="display px-1 pb-3 text-4xl">Съобщения</h1>
      <ul className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto">
        {SIDEBAR[r.viewer].map((c, i) => (
          <li key={c.name}>
            <div className={`flex gap-3 rounded-[6px] px-3 py-3 ${i === 0 ? "bg-rule-soft" : "bg-surface"}`} aria-current={i === 0 ? "page" : undefined}>
              <Avatar name={c.name} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <p className={`truncate ${c.unread ? "font-extrabold" : "font-bold"}`}>{c.name}</p>
                  <span className="ml-auto shrink-0 text-xs text-ink-3">{c.when}</span>
                </div>
                <p className="truncate text-sm text-ink-2">{i === 0 ? PREVIEW[r.scenario] : c.preview}</p>
                <p className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-ink-3">
                  <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                  {c.about}
                </p>
              </div>
              {c.unread && <span className="mt-1 size-3 shrink-0 self-start rounded-full bg-red" aria-label="Непрочетено" />}
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** Fills the screen under the site header so the page itself never scrolls and the footer stays out of sight. */
export function Stage({ r, children }: { r: Room; children: React.ReactNode }) {
  useEffect(() => {
    const el = document.documentElement;
    const before = el.style.overflow;
    el.style.overflow = "hidden";
    return () => {
      el.style.overflow = before;
    };
  }, []);
  return (
    <div className="fixed inset-x-0 bottom-0 top-16 z-30 bg-paper">
      <div className="mx-auto h-full max-w-7xl sm:px-6 sm:py-6">
        <div className="grid h-full grid-rows-[minmax(0,1fr)] overflow-hidden md:grid-cols-[22rem_minmax(0,1fr)] md:gap-6">
          <Sidebar r={r} />
          {children}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ small parts */

export function Rivet({ kind, light = false }: { kind: "filled" | "ring"; light?: boolean }) {
  const tone = light ? (kind === "filled" ? "bg-white" : "ring-white") : kind === "filled" ? "bg-ink" : "ring-ink";
  return <span aria-hidden className={`inline-block size-3 shrink-0 rounded-full ${kind === "ring" ? "ring-2 ring-inset" : ""} ${tone}`} />;
}

export function statusOf(b: BookingData): { word: string; rivet: "filled" | "ring" | null } {
  if (b.status === "confirmed") return { word: b.past ? "Минал" : "Потвърдено", rivet: "filled" };
  if (b.status === "proposed") return { word: "Чака отговор", rivet: "ring" };
  return { word: b.status === "declined" ? "Отказано" : "Отменено", rivet: null };
}

export const KIND = { inspection: "Оглед", work: "Работа" } as const;

/** a card that is over, declined or cancelled steps back to Panel Surface */
export const isQuiet = (b: BookingData) => b.status === "declined" || b.status === "cancelled" || (b.status === "confirmed" && b.past);

export function BackButton({ r, className = "" }: { r: Room; className?: string }) {
  return (
    <button type="button" className={`grid size-11 shrink-0 place-items-center rounded-[6px] md:hidden ${className}`} aria-label="Всички разговори" onClick={() => r.flash("Проба: тук се връща към списъка с разговори")}>
      <ArrowLeft className="size-5" aria-hidden />
    </button>
  );
}

export function callHref(r: Room) {
  return `tel:${r.partner.phone.replace(/\s/g, "")}`;
}

export type MenuItem = { label: string; hint?: string; icon?: React.ReactNode; onSelect: () => void };

/** A button with a small list that closes on Esc, on a click outside and after a choice. */
export function Menu({
  label,
  trigger,
  triggerClass,
  items,
  placement = "down-right",
  width = "w-56",
}: {
  label: string;
  trigger: (open: boolean) => React.ReactNode;
  triggerClass: string;
  items: MenuItem[];
  placement?: "down-right" | "up-left";
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  return (
    <div ref={wrap} className="relative shrink-0">
      <button type="button" className={triggerClass} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {trigger(open)}
      </button>
      {open && (
        <ul role="menu" className={`absolute z-40 grid gap-1 rounded-[10px] bg-surface p-1.5 text-ink shadow-[var(--shadow-lg)] ${width} ${placement === "down-right" ? "right-0 top-full mt-1" : "bottom-full left-0 mb-2"}`}>
          {items.map((it) => (
            <li key={it.label} role="none">
              <button
                type="button"
                role="menuitem"
                className="flex min-h-11 w-full items-start gap-3 rounded-[6px] px-3 py-2 text-left hover:bg-paper"
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
              >
                {it.icon}
                <span>
                  <span className="block font-bold">{it.label}</span>
                  {it.hint && <span className="block text-sm text-ink-2">{it.hint}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Small ink note above the composer for buttons that only exist in the real product. */
export function Flash({ r }: { r: Room }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-3 bottom-full z-40 mb-2 flex justify-center">
      {r.note && <p className="rounded-[6px] bg-ink px-3 py-2 text-sm font-semibold text-white shadow-[var(--shadow-md)]">{r.note}</p>}
    </div>
  );
}

export function PhotoPair() {
  return (
    <div className="mb-1.5 flex flex-wrap gap-1.5">
      {PHOTOS.map((src) => (
        <div key={src} className="relative size-28 overflow-hidden rounded-[8px] bg-surface-2 sm:size-36">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Снимка на лампите" className="size-full object-cover" />
          <span className="absolute inset-x-1 bottom-1 rounded-[4px] bg-ink/85 px-1.5 py-0.5 text-center text-[0.7rem] font-bold text-white">Демо изображение</span>
        </div>
      ))}
    </div>
  );
}

type TextMsg = Extract<Msg, { t: "text" }>;

/** One chat bubble with its date label, photos, time and send state; a failed one can be retried below it. */
export function TextBubble({ m, r, round = "rounded-[14px]" }: { m: TextMsg; r: Room; round?: string }) {
  const mine = m.from === r.viewer;
  const tail = mine ? "rounded-br-[4px]" : "rounded-bl-[4px]";
  const tone = m.state === "failed" ? "bg-danger-soft text-ink" : mine ? "bg-ink text-white" : "bg-surface text-ink";
  return (
    <>
      <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
        <div className={`max-w-[85%] px-3.5 py-2 sm:max-w-[75%] ${round} ${tail} ${tone}`}>
          {m.label && (
            <p className={`mb-1.5 inline-flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-sm font-bold text-ink ${mine ? "bg-rule" : "bg-rule-soft"}`}>
              <CalendarDays className="size-4 shrink-0" aria-hidden />
              <span className="numerals text-base">{m.label}</span>
            </p>
          )}
          {m.photos && <PhotoPair />}
          <p className="whitespace-pre-wrap break-words">{m.body}</p>
          <p className={`mt-0.5 flex items-center justify-end gap-1 text-[0.72rem] ${mine && m.state !== "failed" ? "text-white/70" : "text-ink-3"}`}>
            <span className="numerals text-[0.85rem]">{m.time}</span>
            {mine && m.state === "sending" && (
              <>
                <Check className="size-3.5" aria-hidden />
                Изпраща се
              </>
            )}
            {mine && m.state === "sent" && <CheckCheck className="size-3.5" aria-label="Изпратено" />}
          </p>
        </div>
      </div>
      {m.state === "failed" && (
        <button type="button" onClick={() => r.retry(m.id)} className="mt-1 inline-flex min-h-11 items-center gap-1.5 justify-self-end px-1 text-sm font-bold text-danger">
          <RotateCw className="size-3.5" aria-hidden /> Не е изпратено · Опитай пак
        </button>
      )}
    </>
  );
}

/** Actions under a booking card, with the real texts: confirm or decline a proposal, withdraw your own, cancel a confirmed one after asking. */
export function BookingActions({ r, id, b }: { r: Room; id: string; b: BookingData }) {
  const first = r.partner.first;
  if (b.status === "proposed" && b.by !== r.viewer) {
    return (
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button type="button" className="btn btn-primary" onClick={() => r.actBooking(id, "confirm")}>
          Потвърди
        </button>
        <button type="button" className="btn btn-outline" onClick={() => r.actBooking(id, "decline")}>
          Не мога
        </button>
      </div>
    );
  }
  if (b.status === "proposed") {
    return (
      <div className="mt-1 flex items-center justify-between gap-2 text-sm text-ink-2">
        <span>Чакаме отговор от {first}.</span>
        <button type="button" className="min-h-11 px-2 font-bold underline" onClick={() => r.actBooking(id, "cancel")}>
          Оттегли
        </button>
      </div>
    );
  }
  if (b.status === "confirmed" && !b.past) {
    if (r.cancelAsk === id) {
      return (
        <div className="mt-2 rounded-[6px] bg-paper p-2.5" role="alertdialog" aria-label="Отмяна на уговорката">
          <p className="font-bold">Да отменя ли уговорката?</p>
          <p className="text-sm text-ink-2">Другата страна ще види съобщение.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn btn-danger" onClick={() => r.actBooking(id, "cancel")}>
              Да, отмени
            </button>
            <button type="button" className="btn btn-outline" onClick={() => r.setCancelAsk(null)}>
              Не
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="mt-1 flex items-center justify-between gap-2 text-sm text-ink-2">
        <span>{r.viewer === "craftsman" ? "Часът е зает в календара ти." : "Часът е запазен в календара на майстора."}</span>
        <button type="button" className="min-h-11 shrink-0 px-2 font-bold text-danger underline" onClick={() => r.setCancelAsk(id)}>
          Отмени
        </button>
      </div>
    );
  }
  return null;
}

/** Five stars, a short text and „Публикувай“; the frame around it belongs to the variant. */
export function RateFields({ r, idPrefix }: { r: Room; idPrefix: string }) {
  const labels = ["", "Лошо", "Слабо", "Добре", "Много добре", "Отлично"];
  return (
    <div className="grid gap-2">
      <fieldset>
        <legend className="sr-only">Оценка</legend>
        <div className="flex items-center">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" className="grid size-11 place-items-center rounded-[6px]" aria-label={`${i} от 5: ${labels[i]}`} aria-pressed={r.rate.rating === i} onClick={() => r.rateSet({ rating: i })}>
              <Star className={`size-8 ${i <= r.rate.rating ? "fill-rule text-ink" : "text-line-strong"}`} strokeWidth={1.5} aria-hidden />
            </button>
          ))}
          <span className="ml-2 font-bold" aria-live="polite">
            {labels[r.rate.rating]}
          </span>
        </div>
      </fieldset>
      <label htmlFor={`${idPrefix}-rate-text`} className="sr-only">
        Кратък отзив
      </label>
      <textarea
        id={`${idPrefix}-rate-text`}
        rows={2}
        maxLength={1000}
        value={r.rate.text}
        onChange={(e) => r.rateSet({ text: e.target.value })}
        placeholder="Какво беше добре и какво не? (по желание)"
        className="field min-h-0 resize-none"
      />
      {r.rate.error && <p className="error-text !mt-0">{r.rate.error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary" onClick={r.publish}>
          Публикувай
        </button>
        <button type="button" className="btn btn-ghost" onClick={r.rateClose}>
          Не сега
        </button>
      </div>
    </div>
  );
}

export function RateDone({ className = "" }: { className?: string }) {
  return (
    <p role="status" className={`rounded-[10px] bg-free-soft px-3 py-2 text-sm font-semibold text-free ${className}`}>
      Отзивът е публикуван. Благодарим!
    </p>
  );
}

/** The craftsman's confirm step before the invite goes out. */
export function askText(r: Room) {
  return `Ще пратим на ${r.partner.first} покана за отзив. Следваща покана към нея може след 30 дни.`;
}

export function ComposerField({ r, box: ref, id, className = "" }: { r: Room; box: React.RefObject<HTMLTextAreaElement | null>; id: string; className?: string }) {
  // The field grows with its text, up to about six lines
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + el.offsetHeight - el.clientHeight, 160)}px`;
  }, [ref, r.text]);
  return (
    <>
      <label htmlFor={id} className="sr-only">
        Съобщение
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={1}
        maxLength={4000}
        value={r.text}
        onChange={(e) => r.setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && enterSends()) {
            e.preventDefault();
            r.submit();
          }
        }}
        placeholder="Съобщение…"
        className={`field max-h-40 min-h-11 resize-none py-2.5 ${className}`}
        enterKeyHint="enter"
      />
    </>
  );
}

export function SendButton({ r, className = "btn btn-primary" }: { r: Room; className?: string }) {
  return (
    <button type="submit" className={`${className} size-11 shrink-0 p-0`} disabled={!r.text.trim()} aria-label="Изпрати">
      <SendHorizontal className="size-5" aria-hidden />
    </button>
  );
}

/** From md up only: on a phone the line would only cost height. */
export function Hint({ r, className = "" }: { r: Room; className?: string }) {
  return (
    <p className={`hidden text-xs text-ink-3 md:block ${className}`}>
      Enter изпраща, Shift+Enter за нов ред. Когато се разберете, натиснете {r.viewer === "client" ? "„Уговорка“" : "„Предложи“"}.
    </p>
  );
}

/** Ready answers in one row that scrolls sideways; „Запази“ and „Промени“ stay at its end. */
export function QuickRow({ r }: { r: Room }) {
  const q = r.quick;
  return (
    <div
      aria-label="Бързи отговори"
      className="flex items-center gap-1.5 overflow-x-auto pr-8 [-ms-overflow-style:none] [mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {q.defaults.map((t) => (
        <button key={t} type="button" className="chip shrink-0 whitespace-nowrap" onClick={() => q.pick(t)}>
          {t}
        </button>
      ))}
      {q.own.map((o) => (
        <span key={o.id} className="inline-flex shrink-0 items-center">
          <button type="button" className="chip whitespace-nowrap bg-rule-soft" onClick={() => q.pick(o.body)}>
            {o.body}
          </button>
          {q.edit && (
            <button type="button" className="grid size-10 place-items-center text-danger" onClick={() => q.remove(o.id)} aria-label={`Изтрий „${o.body}“`}>
              <X className="size-4" aria-hidden />
            </button>
          )}
        </span>
      ))}
      <button type="button" className="inline-flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-sm font-bold text-ink-2 hover:bg-paper" onClick={q.save} title="Запази написаното като бърз отговор">
        <Plus className="size-3.5" aria-hidden /> Запази
      </button>
      {q.own.length > 0 && (
        <button type="button" className="min-h-10 shrink-0 whitespace-nowrap px-2 text-sm text-ink-3 underline" onClick={q.toggleEdit}>
          {q.edit ? "Готово" : "Промени"}
        </button>
      )}
    </div>
  );
}
