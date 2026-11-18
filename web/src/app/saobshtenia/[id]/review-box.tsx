"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { submitReview } from "@/app/actions/engage";
import type { FormState } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { FieldError, SubmitButton } from "@/components/submit-button";

export type ReviewBoxKind = "ask" | "rate" | "update";
export type MyReview = { rating: number; body: string };

/** `review_box` comes back from the database as a plain string; keep the three known values. */
export const toReviewBox = (v: string | null | undefined): ReviewBoxKind | null => (v === "ask" || v === "rate" || v === "update" ? v : null);

const LABELS = ["", "Лошо", "Слабо", "Добре", "Много добре", "Отлично"];

/** One compact Pale Rule Yellow field above the composer; the confirm step and the review form replace its content in place. */
export function ReviewBox({
  box,
  partnerFirst,
  craftsmanId,
  slug,
  myReview,
  conversationId,
  formOpen,
  onFormOpenChange,
  onPublished,
  onAsked,
}: {
  box: ReviewBoxKind | null;
  partnerFirst: string;
  craftsmanId: string | null;
  slug: string | null;
  myReview: MyReview | null;
  conversationId: string;
  formOpen: boolean;
  onFormOpenChange: (open: boolean) => void;
  onPublished: () => void;
  /** called after the invite went out, so the caller can ask the database for the box again */
  onAsked?: () => void;
}) {
  const [step, setStep] = useState<"idle" | "confirm">("idle");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);

  // Craftsman: tell the client the work is done; the client gets a message with the review button
  async function askReview() {
    setSending(true);
    const { error } = await createClient().rpc("request_review_in_chat", { p_conversation: conversationId });
    setSending(false);
    if (error) return void toast.error(error.message);
    setSent(true);
    onAsked?.();
    toast.success("Клиентът получи съобщение с покана за отзив.");
  }

  if (done) return <RateDone />;

  if (formOpen && craftsmanId && slug) {
    return (
      <RateForm
        heading={myReview ? `Обнови отзива за ${partnerFirst}` : `Оцени ${partnerFirst}`}
        craftsmanId={craftsmanId}
        slug={slug}
        myReview={myReview}
        onClose={() => onFormOpenChange(false)}
        onSaved={() => {
          setDone(true);
          onFormOpenChange(false);
          onPublished();
        }}
      />
    );
  }

  if (box === "rate" || box === "update") {
    const text = box === "rate" ? `Оцени ${partnerFirst}` : `Обнови отзива за ${partnerFirst}`;
    return (
      <div className="mx-3 mb-2 flex items-center gap-3 rounded-[10px] bg-rule-soft py-1.5 pl-3 pr-1.5">
        <Star className="size-5 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1 font-semibold leading-tight">{text}</p>
        <button type="button" className="btn btn-primary btn-sm min-h-11" onClick={() => onFormOpenChange(true)}>
          {box === "rate" ? "Оцени" : "Обнови"}
        </button>
      </div>
    );
  }

  if (box !== "ask" || sent) return null;

  if (step === "confirm") {
    return (
      <div className="mx-3 mb-2 rounded-[10px] bg-rule-soft p-3" role="alertdialog" aria-label="Покана за отзив">
        <p className="leading-snug">
          Ще пратим на {partnerFirst} покана за отзив. Следваща покана в този разговор може след 30 дни.
        </p>
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn btn-primary" onClick={askReview} disabled={sending}>
            Прати поканата
          </button>
          <button type="button" className="btn btn-outline" onClick={() => setStep("idle")} disabled={sending}>
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
      <button type="button" className="btn btn-primary btn-sm min-h-11" onClick={() => setStep("confirm")}>
        Да, поискай отзив
      </button>
    </div>
  );
}

function RateDone() {
  return (
    <p role="status" className="mx-3 mb-2 rounded-[10px] bg-free-soft px-3 py-2 text-sm font-semibold text-free">
      Отзивът е публикуван. Благодарим!
    </p>
  );
}

/** Five stars, a short text and „Публикувай“, saved through the same `submitReview` as the profile form. */
function RateForm({
  heading,
  craftsmanId,
  slug,
  myReview,
  onClose,
  onSaved,
}: {
  heading: string;
  craftsmanId: string;
  slug: string;
  myReview: MyReview | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const id = useId();
  const [state, action] = useActionState<FormState, FormData>(submitReview, {});
  const [rating, setRating] = useState(myReview?.rating ?? 0);
  useEffect(() => {
    if (state.ok) onSaved();
  }, [state.ok, onSaved]);

  return (
    <form action={action} className="mx-3 mb-2 rounded-[10px] bg-rule-soft p-3">
      <input type="hidden" name="craftsmanId" value={craftsmanId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="rating" value={rating || ""} />
      <p className="mb-1 flex items-center gap-2 font-bold">
        <Star className="size-5 shrink-0" aria-hidden /> {heading}
      </p>
      <div className="grid gap-2">
        <fieldset>
          <legend className="sr-only">Оценка</legend>
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                className="grid size-11 place-items-center rounded-[6px]"
                aria-label={`${i} от 5: ${LABELS[i]}`}
                aria-pressed={rating === i}
                onClick={() => setRating(i)}
              >
                <Star className={`size-8 ${i <= rating ? "fill-rule text-ink" : "text-line-strong"}`} strokeWidth={1.5} aria-hidden />
              </button>
            ))}
            <span className="ml-2 font-bold" aria-live="polite">
              {LABELS[rating]}
            </span>
          </div>
          <FieldError id={`${id}-rating-err`} message={state.errors?.rating} />
        </fieldset>
        <label htmlFor={`${id}-text`} className="sr-only">
          Кратък отзив
        </label>
        <textarea
          id={`${id}-text`}
          name="body"
          rows={2}
          maxLength={1000}
          defaultValue={state.values?.body ?? myReview?.body ?? ""}
          placeholder="Какво беше добре и какво не? (по желание)"
          className="field min-h-0 resize-none"
          aria-invalid={Boolean(state.errors?.body)}
        />
        <FieldError id={`${id}-body-err`} message={state.errors?.body} />
        {state.message && !state.ok && <p className="error-text !mt-0">{state.message}</p>}
        <div className="flex gap-2">
          <SubmitButton pendingText="Записваме…">Публикувай</SubmitButton>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Не сега
          </button>
        </div>
      </div>
    </form>
  );
}
