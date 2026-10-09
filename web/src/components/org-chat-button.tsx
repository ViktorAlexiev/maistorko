"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { startOrgConversation } from "@/app/actions/engage";
import type { FormState } from "@/app/actions/auth";
import { FieldError, FormMessage, SubmitButton } from "@/components/submit-button";

/** "Пиши на фирмата": a short form in a sheet; the message goes to the company's inbox (owner and managers). */
export function OrgChatButton({
  orgId,
  orgName,
  signedIn,
  loginHref,
  className = "btn btn-primary",
  label = "Пиши на фирмата",
}: {
  orgId: string;
  orgName: string;
  signedIn: boolean;
  loginHref: string;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<FormState, FormData>(startOrgConversation, {});

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  if (!signedIn) {
    return (
      <Link href={loginHref} className={className}>
        <MessageCircle className="size-4" aria-hidden /> {label}
      </Link>
    );
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        <MessageCircle className="size-4" aria-hidden /> {label}
      </button>
      <dialog ref={ref} className="sheet" aria-labelledby={`oc-${orgId}`} onClose={() => setOpen(false)} onClick={(e) => e.target === ref.current && setOpen(false)}>
        <form action={action} className="safe-bottom grid gap-4 p-5" noValidate>
          <input type="hidden" name="orgId" value={orgId} />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={`oc-${orgId}`} className="display text-4xl">
                Пиши на {orgName}
              </h2>
              <p className="mt-1 text-sm text-ink-2">Съобщението стига до диспечерите на фирмата. Те ще ви отговорят или ще го предадат на подходящ майстор.</p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Затвори">
              <X className="size-6" aria-hidden />
            </button>
          </div>
          <div>
            <label htmlFor={`oc-body-${orgId}`} className="label">
              Съобщение
            </label>
            <textarea
              id={`oc-body-${orgId}`}
              name="body"
              className="field"
              rows={5}
              maxLength={4000}
              required
              defaultValue={state.values?.body ?? ""}
              placeholder="Здравейте! Трябва ми… Адресът е в … Кога можете?"
              aria-invalid={Boolean(state.errors?.body)}
            />
            <FieldError id={`oc-body-err-${orgId}`} message={state.errors?.body} />
          </div>
          <FormMessage state={state} />
          <SubmitButton className="btn btn-primary btn-lg" pendingText="Изпращаме…">
            Изпрати
          </SubmitButton>
        </form>
      </dialog>
    </>
  );
}
