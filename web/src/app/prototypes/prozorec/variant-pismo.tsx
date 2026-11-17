"use client";

import { useRef } from "react";
import { ChevronDown, LoaderCircle, SendHorizontal } from "lucide-react";
import { CRAFTSMAN } from "./data";
import type { First } from "./first";
import { AddTile, BODY_HINT, bodyPlaceholder, DateBlock, PhotoNote, PriceQuestions, SEND_TEXT, Thumb, WorkSelect } from "./parts";

/** A field that stays quiet until it is used: Panel Surface ground, no visible stroke. */
const QUIET = "field !border-transparent !bg-paper";

/** „Писмо“: one Card Surface sheet. „Кога“ and „За какво“ are quiet inline fields, the message is large and central, photos lie under it like enclosures. */
export function Pismo({ f }: { f: First }) {
  const body = useRef<HTMLTextAreaElement>(null);
  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col bg-paper"
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.send()) body.current?.focus();
      }}
    >
      <fieldset disabled={f.sending} className="min-h-0 min-w-0 flex-1 overflow-y-auto px-3 pb-3 pt-3 [overscroll-behavior:contain]">
        <legend className="sr-only">Първо съобщение</legend>
        <div className="overflow-hidden rounded-[10px] bg-surface">
          <div aria-hidden className="graduations graduations-top h-2 bg-rule" />
          <div className="grid gap-4 p-4 pt-3">
            <p className="text-sm font-bold text-ink-2">
              До <span className="text-ink">{CRAFTSMAN.name}</span> · {CRAFTSMAN.category}
            </p>
            <div className="grid gap-x-3 gap-y-1 sm:grid-cols-[5.5rem_minmax(0,1fr)] sm:items-start">
              <label htmlFor="pm-date" className="label !mb-0 pt-2 sm:pt-3">
                Кога <span className="font-normal text-ink-3">(по желание)</span>
              </label>
              <DateBlock f={f} id="pm-date" fieldClass={QUIET} chipClass="chip !border-transparent !bg-paper aria-pressed:!bg-ink aria-pressed:!text-white" />
              <label htmlFor="pm-work" className="label !mb-0 pt-2 sm:pt-3">
                За какво
              </label>
              <WorkSelect f={f} id="pm-work" className={QUIET} />
            </div>
            <div>
              <label htmlFor="pm-body" className="sr-only">
                Съобщение
              </label>
              <textarea
                id="pm-body"
                ref={body}
                className="field !min-h-[9rem] !border-transparent !bg-paper px-3.5 py-3 text-[1.05rem] aria-invalid:!border-danger"
                rows={6}
                maxLength={4000}
                value={f.body}
                onChange={(e) => f.setBody(e.target.value)}
                placeholder={bodyPlaceholder(f.date)}
                aria-invalid={Boolean(f.error)}
                aria-describedby={f.error ? "pm-body-err" : "pm-body-hint"}
              />
              <p id="pm-body-hint" className="hint">
                {BODY_HINT}
              </p>
              {f.error && (
                <p id="pm-body-err" className="error-text" role="alert">
                  {f.error}
                </p>
              )}
            </div>
            <div>
              <button type="button" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-ink-2 underline" aria-expanded={f.askOpen} aria-controls="pm-help" onClick={() => f.setAskOpen(!f.askOpen)}>
                Помогнете на майстора да даде цена
                <ChevronDown className={`size-4 transition-transform motion-reduce:transition-none ${f.askOpen ? "rotate-180" : ""}`} aria-hidden />
              </button>
              {f.askOpen && (
                <div id="pm-help" className="mt-1 rounded-[10px] bg-paper p-3">
                  <PriceQuestions f={f} id="pm-q" />
                </div>
              )}
            </div>
            <div>
              <p className="label" id="pm-photos">
                Снимки към писмото
              </p>
              <ul className="grid grid-cols-2 gap-3" aria-labelledby="pm-photos">
                {f.photos.items.map((p) => (
                  <Thumb key={p.key} p={p} onRemove={f.photos.remove} className="aspect-[4/3]" big />
                ))}
                <AddTile f={f} id="pm-files" className="aspect-[4/3]">
                  Добави снимка
                </AddTile>
              </ul>
              <PhotoNote f={f} />
            </div>
          </div>
        </div>
      </fieldset>
      <div className="safe-bottom shrink-0 bg-paper px-3 pb-3 pt-1">
        <button type="submit" className="btn btn-primary w-full" disabled={f.sending} aria-disabled={f.sending}>
          {f.sending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden /> : <SendHorizontal className="size-4" aria-hidden />}
          {f.sending ? SEND_TEXT.busy : SEND_TEXT.idle}
        </button>
      </div>
    </form>
  );
}
