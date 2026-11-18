"use client";

import { useActionState, useEffect, useState } from "react";
import { Star } from "lucide-react";
import { deleteReview, submitReview } from "@/app/actions/engage";
import type { FormState } from "@/app/actions/auth";
import { FieldError, FormMessage, SubmitButton } from "@/components/submit-button";
import { DeleteConfirm, useDeleteConfirm } from "@/components/review-delete-confirm";

const LABELS = ["", "Лошо", "Слабо", "Добре", "Много добре", "Отлично"];

export function ReviewForm({
  craftsmanId = "",
  slug,
  existing,
  deleteId,
  canReviewAgain = true,
  onDone,
}: {
  craftsmanId?: string;
  slug: string;
  existing?: { rating: number; body: string } | null;
  /** the id of the viewer's review: only when set the form offers to delete it (the profile does) */
  deleteId?: string;
  /** false when the viewer could not write a new review after deleting this one (the confirm text then says so) */
  canReviewAgain?: boolean;
  /** called after the review was saved (e.g. to close a dialog) */
  onDone?: () => void;
}) {
  const [state, action] = useActionState<FormState, FormData>(submitReview, {});
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const shown = hover || rating;
  const { confirming, deleteRef, ask, cancel } = useDeleteConfirm();
  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state.ok, onDone]);

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
      {deleteId && <input type="hidden" name="id" value={deleteId} />}
      {confirming ? (
        <DeleteConfirm
          canWriteAgain={canReviewAgain}
          onCancel={cancel}
          confirm={(disabled) => (
            <button type="submit" formAction={deleteReview} formNoValidate className="btn btn-danger" disabled={disabled}>
              Да, изтрий
            </button>
          )}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <SubmitButton pendingText="Записваме…">{existing ? "Обнови отзива" : "Публикувай отзив"}</SubmitButton>
          {deleteId && (
            <button ref={deleteRef} type="button" onClick={ask} className="ml-auto text-sm font-semibold text-danger underline">
              Изтрий моя отзив
            </button>
          )}
        </div>
      )}
    </form>
  );
}
