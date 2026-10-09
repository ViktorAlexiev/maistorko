"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Flag, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const REASONS = [
  ["spam", "Спам или реклама"],
  ["scam", "Опит за измама"],
  ["offensive", "Обидно или заплашително поведение"],
  ["fake", "Фалшив профил или фалшиви данни"],
  ["other", "Друго"],
] as const;

/**
 * "Докладвай": sends a report to the admins. Signed-out visitors are sent to sign in first.
 * type: profile (target = craftsman id), conversation (target = conversation id), review (target = review id).
 */
export function ReportButton({
  type,
  targetId,
  signedIn,
  loginHref,
  label = "Докладвай",
  className = "btn btn-ghost btn-sm text-ink-2",
}: {
  type: "profile" | "conversation" | "review";
  targetId: string;
  signedIn: boolean;
  loginHref: string;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number][0]>("spam");
  const [details, setDetails] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  if (!signedIn) {
    return (
      <Link href={loginHref} className={className} aria-label={label || "Докладвай"}>
        <Flag className="size-4" aria-hidden /> {label}
      </Link>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const { error } = await createClient().rpc("report_content", {
        p_type: type,
        p_target: targetId,
        p_reason: reason,
        p_details: details.trim() || undefined,
      });
      if (error) return void toast.error(error.message);
      toast.success("Благодарим. Администраторите ще го прегледат.");
      setDetails("");
      setOpen(false);
    });
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-label={label || "Докладвай"} title="Докладвай">
        <Flag className="size-4" aria-hidden /> {label}
      </button>
      <dialog ref={ref} className="sheet" aria-labelledby={`rep-${targetId}`} onClose={() => setOpen(false)} onClick={(e) => e.target === ref.current && setOpen(false)}>
        <form onSubmit={submit} className="safe-bottom grid gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id={`rep-${targetId}`} className="display text-4xl">
              Докладвай
            </h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Затвори">
              <X className="size-6" aria-hidden />
            </button>
          </div>
          <fieldset>
            <legend className="label">Какъв е проблемът?</legend>
            <div className="grid gap-2">
              {REASONS.map(([key, text]) => (
                <label key={key} className="flex cursor-pointer items-center gap-3">
                  <input type="radio" name="reason" className="check" checked={reason === key} onChange={() => setReason(key)} />
                  {text}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor={`rep-d-${targetId}`} className="label">
              Какво се случи? <span className="font-normal text-ink-3">(по желание)</span>
            </label>
            <textarea id={`rep-d-${targetId}`} className="field" rows={3} maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
            {pending ? "Изпращаме…" : "Изпрати доклад"}
          </button>
          <p className="text-sm text-ink-3">Докладът го виждат само администраторите. Този, когото докладвате, не получава известие.</p>
        </form>
      </dialog>
    </>
  );
}
