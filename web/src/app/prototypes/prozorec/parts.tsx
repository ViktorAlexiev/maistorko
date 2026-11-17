"use client";

import { LoaderCircle, X } from "lucide-react";
import { DateField } from "@/components/date-time-fields";
import { relativeDay } from "@/lib/format";
import { SLOT_DEFS, slotLabel } from "@/lib/slots";
import { CRAFTSMAN, TODAY } from "./data";
import type { First, PhotoItem } from "./first";

/** The fields of today's first message used by „Като в разговора“. */

export const BODY_HINT = "Телефонът ви остава скрит, освен ако не го напишете.";

export const bodyPlaceholder = (date: string) => `Здравейте! Трябва ми… Адресът е в … Удобно ли ви е${date ? ` ${relativeDay(date, TODAY)}` : ""}?`;

/** Date (optional), the preferred part of the day and today's hints. */
export function DateBlock({ f, id, fieldClass = "field", chipClass = "chip" }: { f: First; id: string; fieldClass?: string; chipClass?: string }) {
  return (
    <div>
      <DateField id={id} min={TODAY} value={f.date} onChange={f.setDate} className={fieldClass} ariaLabel="Дата" />
      {f.date && (
        <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Част от деня">
          {SLOT_DEFS.map((s) => (
            <button key={s.key} type="button" className={`${chipClass} min-h-11`} aria-pressed={f.slot === s.key} onClick={() => f.setSlot(f.slot === s.key ? null : s.key)}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      {f.date && (
        <p className="hint">
          {f.slot ? `Предпочитано: ${slotLabel(f.slot)}. ` : ""}
          {f.busyDay ? "Отбелязан като зает: питайте дали може. " : ""}
          Майсторът потвърждава деня в чата.{" "}
          <button type="button" className="underline" onClick={() => f.setDate("")}>
            Без конкретна дата
          </button>
        </p>
      )}
    </div>
  );
}

/** Inside of „Помогнете на майстора да даде цена“: the kind of work (if more than one), the questions, and the button that adds the answers to the message. */
export function PriceQuestions({ f, id, fieldClass = "field", onAdded }: { f: First; id: string; fieldClass?: string; onAdded?: () => void }) {
  const cats = CRAFTSMAN.categories;
  return (
    <div className="grid gap-3">
      {cats.length > 1 && (
        <div>
          <label htmlFor={`${id}-cat`} className="label">
            Вид работа
          </label>
          <select id={`${id}-cat`} className={fieldClass} value={f.catSlug} onChange={(e) => f.setCatSlug(e.target.value)}>
            {cats.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {f.questions.map((q) => (
        <div key={q.id}>
          <label htmlFor={`${id}-${q.id}`} className="label">
            {q.label}
          </label>
          {q.options ? (
            <select id={`${id}-${q.id}`} className={fieldClass} value={f.answers[q.id] ?? ""} onChange={(e) => f.setAnswer(q.id, e.target.value)}>
              <option value="">Не е задължително</option>
              {q.options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <input id={`${id}-${q.id}`} className={fieldClass} maxLength={160} value={f.answers[q.id] ?? ""} placeholder={q.placeholder} onChange={(e) => f.setAnswer(q.id, e.target.value)} />
          )}
        </div>
      ))}
      <button type="button" className="btn btn-rule btn-sm min-h-11 justify-self-start" disabled={!f.composed}
        onClick={() => {
          f.addAnswers();
          onAdded?.();
        }}
      >
        Добави към съобщението
      </button>
    </div>
  );
}

/** One picked photo: preview, a spinner while it uploads, the „Демо изображение“ label on demo files, and an × that removes it. */
export function Thumb({ p, onRemove, className = "" }: { p: PhotoItem; onRemove: (key: string) => void; className?: string }) {
  return (
    <li className={`relative ${className}`}>
      <div className="relative size-full overflow-hidden rounded-[6px] bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.src} alt="Избрана снимка" className="size-full object-cover" />
        {p.demo && (
          <span className="absolute inset-x-0.5 bottom-0.5 rounded-[4px] bg-ink/85 px-1 py-0.5 text-center text-[0.625rem] font-bold leading-tight text-white">Демо изображение</span>
        )}
        {p.uploading && (
          <span className="absolute inset-0 grid place-items-center bg-surface/70" role="status" aria-label="Снимката се качва">
            <LoaderCircle className="size-6 animate-spin text-ink motion-reduce:animate-none" aria-hidden />
          </span>
        )}
      </div>
      <button type="button" className="absolute -right-2.5 -top-2.5 grid size-11 place-items-center" aria-label="Махни снимката" onClick={() => onRemove(p.key)}>
        <span className="grid size-6 place-items-center rounded-full bg-ink text-white shadow-[var(--shadow-sm)]">
          <X className="size-3.5" aria-hidden />
        </span>
      </button>
    </li>
  );
}
