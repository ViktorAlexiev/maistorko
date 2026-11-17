"use client";

import { useRef } from "react";
import { LoaderCircle } from "lucide-react";
import type { First } from "./first";
import { AddTile, BODY_HINT, bodyPlaceholder, DateBlock, PhotoNote, PriceQuestions, SEND_TEXT, Thumb, WorkSelect } from "./parts";

/** „Формуляр“: today's fields in today's order, light and in the language of „Тихо“: no dark ground, no lines, fields on the window's surface. */
export function Formular({ f }: { f: First }) {
  const body = useRef<HTMLTextAreaElement>(null);
  return (
    <form
      noValidate
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.send()) body.current?.focus();
      }}
    >
      <fieldset disabled={f.sending} className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-4 pb-3 pt-2 [overscroll-behavior:contain]">
        <legend className="sr-only">Първо съобщение</legend>
        <div>
          <label htmlFor="fm-date" className="label">
            Дата <span className="font-normal text-ink-3">(по желание)</span>
          </label>
          <DateBlock f={f} id="fm-date" />
        </div>
        <div>
          <label htmlFor="fm-work" className="label">
            Каква работа
          </label>
          <WorkSelect f={f} id="fm-work" />
        </div>
        <div className="rounded-[10px] bg-surface-2">
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm font-bold"
            onClick={() => f.setAskOpen(!f.askOpen)}
            aria-expanded={f.askOpen}
          >
            <span>Помогнете на майстора да даде цена</span>
            <span aria-hidden>{f.askOpen ? "−" : "+"}</span>
          </button>
          {f.askOpen && (
            <div className="px-3 pb-3">
              <PriceQuestions f={f} id="fm-q" />
            </div>
          )}
        </div>
        <div>
          <label htmlFor="fm-body" className="label">
            Съобщение
          </label>
          <textarea
            id="fm-body"
            ref={body}
            className="field !min-h-0"
            rows={4}
            maxLength={4000}
            value={f.body}
            onChange={(e) => f.setBody(e.target.value)}
            placeholder={bodyPlaceholder(f.date)}
            aria-invalid={Boolean(f.error)}
            aria-describedby={f.error ? "fm-body-err" : "fm-body-hint"}
          />
          <p id="fm-body-hint" className="hint">
            {BODY_HINT}
          </p>
          {f.error && (
            <p id="fm-body-err" className="error-text" role="alert">
              {f.error}
            </p>
          )}
        </div>
        <div>
          <p className="label" id="fm-photos">
            Снимки
          </p>
          <ul className="grid grid-cols-4 gap-2" aria-labelledby="fm-photos">
            {f.photos.items.map((p) => (
              <Thumb key={p.key} p={p} onRemove={f.photos.remove} className="aspect-square" />
            ))}
            <AddTile f={f} id="fm-files" className="aspect-square" />
          </ul>
          <PhotoNote f={f} />
        </div>
      </fieldset>
      <div className="safe-bottom shrink-0 px-4 pb-4 pt-2">
        <button type="submit" className="btn btn-rule w-full" disabled={f.sending} aria-disabled={f.sending}>
          {f.sending && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
          {f.sending ? SEND_TEXT.busy : SEND_TEXT.idle}
        </button>
      </div>
    </form>
  );
}
