"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type FormState } from "@/app/actions/auth";
import { FieldError, FormMessage, SubmitButton } from "@/components/submit-button";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordReset, {});
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="display text-5xl">Забравена парола</h1>
      <p className="mt-3 text-lg text-ink-2">Въведете имейла си и ще ви изпратим линк за нова парола.</p>
      {state.ok ? (
        <div className="mt-8 grid gap-4">
          <FormMessage state={state} />
          <Link href="/vhod" className="btn btn-outline">
            Обратно към вход
          </Link>
        </div>
      ) : (
        <form action={action} className="mt-8 grid gap-5" noValidate>
          <div>
            <label htmlFor="email" className="label">
              Имейл
            </label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="field"
              defaultValue={state.values?.email}
              aria-invalid={Boolean(state.errors?.email)}
              aria-describedby={state.errors?.email ? "email-err" : undefined}
            />
            <FieldError id="email-err" message={state.errors?.email} />
          </div>
          <FormMessage state={state} />
          <SubmitButton className="btn btn-primary btn-lg w-full" pendingText="Изпращаме…">
            Изпрати линк
          </SubmitButton>
          <Link href="/vhod" className="link text-center font-semibold">
            Обратно към вход
          </Link>
        </form>
      )}
    </div>
  );
}
