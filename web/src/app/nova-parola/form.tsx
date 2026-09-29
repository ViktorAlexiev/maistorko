"use client";

import { useActionState } from "react";
import { updatePassword, type FormState } from "@/app/actions/auth";
import { FieldError, FormMessage, SubmitButton } from "@/components/submit-button";

export function NewPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(updatePassword, {});
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="display text-5xl">Нова парола</h1>
      <p className="mt-3 text-lg text-ink-2">Изберете нова парола за профила си.</p>
      <form action={action} className="mt-8 grid gap-5" noValidate>
        <div>
          <label htmlFor="password" className="label">
            Нова парола
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            className="field"
            aria-invalid={Boolean(state.errors?.password)}
            aria-describedby={state.errors?.password ? "password-err" : "password-hint"}
          />
          <p id="password-hint" className="hint">
            Поне 8 символа.
          </p>
          <FieldError id="password-err" message={state.errors?.password} />
        </div>
        <div>
          <label htmlFor="confirm" className="label">
            Повторете паролата
          </label>
          <input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            className="field"
            aria-invalid={Boolean(state.errors?.confirm)}
            aria-describedby={state.errors?.confirm ? "confirm-err" : undefined}
          />
          <FieldError id="confirm-err" message={state.errors?.confirm} />
        </div>
        <FormMessage state={state} />
        <SubmitButton className="btn btn-primary btn-lg w-full" pendingText="Записваме…">
          Запази паролата
        </SubmitButton>
      </form>
    </div>
  );
}
