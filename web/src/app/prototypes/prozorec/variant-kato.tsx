"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { BadgeEuro, CalendarDays, Check, ImagePlus, LoaderCircle, SendHorizontal, Wrench } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { MONTHS_SHORT, WEEKDAYS_SHORT } from "@/lib/format";
import { SLOT_DEFS } from "@/lib/slots";
import { CRAFTSMAN, WORK_OPTIONS, workLabel } from "./data";
import type { First } from "./first";
import { BODY_HINT, bodyPlaceholder, DateBlock, PriceQuestions, Thumb } from "./parts";

type Sheet = "date" | "work" | "price";

/** „чт, 19 ное · сутрин“ */
function dateChip(f: First) {
  const d = new Date(`${f.date}T00:00:00Z`);
  const day = `${WEEKDAYS_SHORT[(d.getUTCDay() + 6) % 7]}, ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
  const part = SLOT_DEFS.find((s) => s.key === f.slot)?.label.toLowerCase();
  return part ? `${day} · ${part}` : day;
}

/** Enter sends on a desktop; on a phone it makes a new line (as in the conversation). */
const enterSends = () => !window.matchMedia("(pointer: coarse), (max-width: 767px)").matches;

const priced = WORK_OPTIONS.filter((o) => o.priced);
const other = WORK_OPTIONS.filter((o) => !o.priced);

/** „Като в разговора“: the window already looks like the conversation it becomes; the first message is written in the same composer. */
export function KatoRazgovor({ f }: { f: First }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const sheetBox = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  // The field grows with its text, up to about six lines
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + el.offsetHeight - el.clientHeight, 160)}px`;
  }, [f.body]);

  const open = (s: Sheet, el: HTMLElement) => {
    opener.current = el;
    setSheet(s);
    requestAnimationFrame(() => sheetBox.current?.focus());
  };
  const close = () => {
    setSheet(null);
    opener.current?.focus();
  };
  const pick = (value: string) => {
    f.setWork(value);
    close();
  };

  const chip = (s: Sheet, set: boolean, icon: React.ReactNode, text: string) => (
    <button
      type="button"
      className={`chip min-h-11 max-w-full ${set ? "!border-rule-soft !bg-rule-soft !text-ink" : ""}`}
      aria-haspopup="dialog"
      aria-expanded={sheet === s}
      onClick={(e) => open(s, e.currentTarget)}
    >
      {icon}
      <span className="truncate">{text}</span>
    </button>
  );

  return (
    <form
      noValidate
      className="relative flex min-h-0 flex-1 flex-col bg-paper"
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.send()) field.current?.focus();
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 text-center">
        <div className="m-auto grid justify-items-center gap-2">
          <Avatar name={CRAFTSMAN.name} size={56} />
          <p className="text-lg font-extrabold leading-tight">Пишете на {CRAFTSMAN.name}</p>
          <p className="-mt-1 text-sm font-semibold text-ink-2">
            {CRAFTSMAN.category} · {CRAFTSMAN.place}
          </p>
          <p className="mt-1 max-w-[18rem] text-ink-2">Опишете какво трябва да се направи. Датата, работата и снимките са по желание и тръгват заедно със съобщението.</p>
        </div>
      </div>

      <div className="safe-bottom bg-surface px-3 pt-2">
        <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Към съобщението">
          {chip("date", Boolean(f.date), <CalendarDays className="size-4 shrink-0" aria-hidden />, f.date ? dateChip(f) : "Дата")}
          {chip("work", Boolean(f.work), <Wrench className="size-4 shrink-0" aria-hidden />, f.work ? workLabel(f.work) : "Каква работа")}
          {chip("price", false, <BadgeEuro className="size-4 shrink-0" aria-hidden />, "Цена")}
        </div>
        {f.photos.items.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2 pr-3 pt-3" aria-label="Снимки към съобщението">
            {f.photos.items.map((p) => (
              <Thumb key={p.key} p={p} onRemove={f.photos.remove} className="size-16" />
            ))}
          </ul>
        )}
        {f.photos.note && (
          <p role="alert" className="error-text !mt-0 mb-2">
            {f.photos.note}
          </p>
        )}
        {f.error && (
          <p id="kr-err" role="alert" className="error-text !mt-0 mb-2">
            {f.error}
          </p>
        )}
        {f.sending && (
          <p role="status" className="mb-2 text-sm font-semibold text-ink-2">
            Изпращаме…
          </p>
        )}
        <div className="flex items-end gap-2">
          <input
            id="kr-files"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="peer sr-only"
            disabled={f.photos.full || f.sending}
            onChange={(e) => {
              if (e.target.files?.length) f.photos.add(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
          <label
            htmlFor="kr-files"
            title="Прикачи снимка"
            className={`btn btn-outline size-11 shrink-0 cursor-pointer p-0 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink ${f.photos.full || f.sending ? "pointer-events-none opacity-50" : ""}`}
          >
            <ImagePlus className="size-5" aria-hidden />
            <span className="sr-only">Прикачи снимка</span>
          </label>
          <label htmlFor="kr-body" className="sr-only">
            Съобщение
          </label>
          <textarea
            id="kr-body"
            ref={field}
            rows={1}
            maxLength={4000}
            value={f.body}
            disabled={f.sending}
            onChange={(e) => f.setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && enterSends()) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={bodyPlaceholder(f.date)}
            className="field max-h-40 min-h-11 resize-none py-2.5"
            enterKeyHint="enter"
            aria-invalid={Boolean(f.error)}
            aria-describedby={f.error ? "kr-err" : "kr-hint"}
          />
          <button type="submit" className="btn btn-rule size-11 shrink-0 p-0" disabled={f.sending} aria-label={f.sending ? "Изпращаме…" : "Изпрати съобщение"} title="Изпрати съобщение">
            {f.sending ? <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden /> : <SendHorizontal className="size-5" aria-hidden />}
          </button>
        </div>
        <p id="kr-hint" className="mb-3 mt-1 text-xs text-ink-3">
          {BODY_HINT}
        </p>
      </div>

      {sheet && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end">
          <button type="button" aria-label="Затвори" tabIndex={-1} className="min-h-0 flex-1 cursor-default bg-ink/25" onClick={close} />
          <div
            ref={sheetBox}
            tabIndex={-1}
            role="dialog"
            aria-label={sheet === "date" ? "Дата" : sheet === "work" ? "Каква работа" : "Помогнете на майстора да даде цена"}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                close();
              }
            }}
            className="max-h-[85%] shrink-0 overflow-y-auto rounded-t-[14px] bg-surface px-4 pb-4 pt-2 shadow-[var(--shadow-lg)] outline-none [overscroll-behavior:contain]"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold">
                {sheet === "date" && (
                  <>
                    Дата <span className="font-normal text-ink-3">(по желание)</span>
                  </>
                )}
                {sheet === "work" && "Каква работа"}
                {sheet === "price" && "Помогнете на майстора да даде цена"}
              </h2>
              <button type="button" className="btn btn-ghost min-h-11 shrink-0" onClick={close}>
                Готово
              </button>
            </div>
            {sheet === "date" && <DateBlock f={f} id="kr-date" />}
            {sheet === "work" && (
              <div className="grid gap-1">
                <WorkRow label="Не е задължително" on={!f.work} onPick={() => pick("")} muted />
                <p className="mt-1 px-3 text-xs font-bold text-ink-3">От ценоразписа</p>
                {priced.map((o) => (
                  <WorkRow key={o.value} label={o.label} on={f.work === o.value} onPick={() => pick(o.value)} />
                ))}
                <p className="mt-1 px-3 text-xs font-bold text-ink-3">Други (цена в чата)</p>
                {other.map((o) => (
                  <WorkRow key={o.value} label={o.label} on={f.work === o.value} onPick={() => pick(o.value)} />
                ))}
              </div>
            )}
            {sheet === "price" && <PriceQuestions f={f} id="kr-q" onAdded={close} />}
          </div>
        </div>
      )}
    </form>
  );
}

function WorkRow({ label, on, onPick, muted = false }: { label: string; on: boolean; onPick: () => void; muted?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onPick} className={`flex min-h-11 items-center justify-between gap-2 rounded-[6px] px-3 text-left ${on ? "bg-rule-soft font-bold" : "hover:bg-paper"} ${muted ? "text-ink-2" : ""}`}>
      {label}
      {on && <Check className="size-4 shrink-0" aria-hidden />}
    </button>
  );
}
