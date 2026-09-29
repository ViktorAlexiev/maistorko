"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { submitReview } from "@/app/actions/engage";
import type { FormState } from "@/app/actions/auth";
import { FieldError, FormMessage, SubmitButton } from "@/components/submit-button";

const LABELS = ["", "Лошо", "Слабо", "Добре", "Много добре", "Отлично"];

export function ReviewForm({
  craftsmanId,
  slug,
  existing,
}: {
  craftsmanId: string;
  slug: string;
  existing?: { rating: number; body: string } | null;
}) {
  const [state, action] = useActionState<FormState, FormData>(submitReview, {});
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const shown = hover || rating;

  return (
    <form action={action} className="grid gap-4 rounded-[10px] border border-line bg-surface p-4 sm:p-5">
      <input type="hidden" name="craftsmanId" value={craftsmanId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="rating" value={rating || ""} />
      <fieldset>
        <legend className="label">{existing ? "Вашата оценка" : "Оценете работата"}</legend>
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              className="rounded p-1"
              aria-label={`${i} от 5: ${LABELS[i]}`}
              aria-pressed={rating === i}
              onMouseEnter={() => setHover(i)}
              onClick={() => setRating(i)}
            >
              <Star
                className={`size-8 transition-transform ${i <= shown ? "fill-rule text-ink" : "text-line-strong"} ${
                  i === hover ? "scale-110" : ""
                }`}
                strokeWidth={1.5}
                aria-hidden
              />
            </button>
          ))}
          <span className="ml-2 font-bold" aria-live="polite">
            {LABELS[shown]}
          </span>
        </div>
        <FieldError id="r-rating-err" message={state.errors?.rating} />
      </fieldset>
      <div>
        <label htmlFor="r-body" className="label">
          Какво беше добре и какво не? <span className="font-normal text-ink-3">(по желание)</span>
        </label>
        <textarea
          id="r-body"
          name="body"
          className="field"
          rows={3}
          maxLength={1000}
          defaultValue={state.values?.body ?? existing?.body ?? ""}
          aria-invalid={Boolean(state.errors?.body)}
        />
        <FieldError id="r-body-err" message={state.errors?.body} />
      </div>
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingText="Записваме…">{existing ? "Обнови отзива" : "Публикувай отзив"}</SubmitButton>
      </div>
    </form>
  );
}
