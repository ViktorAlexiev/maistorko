"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export type ExtraField = { name: string; label: string; placeholder?: string; type?: "text" | "number"; required?: boolean };

/**
 * A contact request (company, Pro, other). Goes to `submit_contact_request`; admins read it in /admin/zapitvaniya.
 * Extra fields end up in the request's payload. "website" is a hidden trap for bots.
 */
export function ContactForm({
  kind,
  extra = [],
  defaultName = "",
  defaultContact = "",
  messageLabel = "Съобщение",
  messagePlaceholder,
  button = "Изпрати",
  success = "Благодарим! Ще се свържем с вас.",
}: {
  kind: "company" | "pro" | "other";
  extra?: ExtraField[];
  defaultName?: string;
  defaultContact?: string;
  messageLabel?: string;
  messagePlaceholder?: string;
  button?: string;
  success?: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload: Record<string, string> = {};
    for (const x of extra) {
      const v = String(f.get(x.name) ?? "").trim();
      if (v) payload[x.name] = v;
    }
    setError(null);
    start(async () => {
      const { error: err } = await createClient().rpc("submit_contact_request", {
        p_kind: kind,
        p_name: String(f.get("name") ?? ""),
        p_contact: String(f.get("contact") ?? ""),
        p_message: String(f.get("message") ?? "") || undefined,
        p_payload: payload,
        p_trap: String(f.get("website") ?? ""),
      });
      if (err) setError(err.message || "Не успяхме да изпратим. Опитайте отново.");
      else setDone(true);
    });
  }

  if (done) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-[8px] bg-free-soft px-4 py-3 font-semibold text-free">
        <CheckCircle2 className="size-5 shrink-0" aria-hidden /> {success}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`cf-${kind}-name`} className="label">
            Име
          </label>
          <input id={`cf-${kind}-name`} name="name" className="field" defaultValue={defaultName} maxLength={120} required autoComplete="name" />
        </div>
        <div>
          <label htmlFor={`cf-${kind}-contact`} className="label">
            Телефон или имейл
          </label>
          <input id={`cf-${kind}-contact`} name="contact" className="field" defaultValue={defaultContact} maxLength={160} required />
        </div>
      </div>
      {extra.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {extra.map((x) => (
            <div key={x.name}>
              <label htmlFor={`cf-${kind}-${x.name}`} className="label">
                {x.label}
              </label>
              <input
                id={`cf-${kind}-${x.name}`}
                name={x.name}
                type={x.type ?? "text"}
                inputMode={x.type === "number" ? "numeric" : undefined}
                className="field"
                placeholder={x.placeholder}
                required={x.required}
                maxLength={120}
              />
            </div>
          ))}
        </div>
      )}
      <div>
        <label htmlFor={`cf-${kind}-message`} className="label">
          {messageLabel} <span className="font-normal text-ink-3">(по желание)</span>
        </label>
        <textarea id={`cf-${kind}-message`} name="message" className="field" rows={4} maxLength={2000} placeholder={messagePlaceholder} />
      </div>
      {/* bots fill every field; people never see this one */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Не попълвайте това поле
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div>
        <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
          {pending ? "Изпращаме…" : button}
        </button>
      </div>
    </form>
  );
}
