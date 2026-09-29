"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type FormState } from "@/app/actions/auth";
import { FieldError, FormMessage, SubmitButton } from "@/components/submit-button";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(signIn, {});
  return (
    <form action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className="label">
          Имейл
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          className="field"
          defaultValue={state.values?.email}
          aria-invalid={Boolean(state.errors?.email)}
          aria-describedby={state.errors?.email ? "email-err" : undefined}
        />
        <FieldError id="email-err" message={state.errors?.email} />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className="label">
            Парола
          </label>
          <Link href="/zabravena-parola" className="link text-sm font-semibold">
            Забравена парола?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
          aria-invalid={Boolean(state.errors?.password)}
          aria-describedby={state.errors?.password ? "password-err" : undefined}
        />
        <FieldError id="password-err" message={state.errors?.password} />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary btn-lg w-full" pendingText="Влизаме…">
        Вход
      </SubmitButton>
      <p className="text-center text-ink-2">
        Нямате профил?{" "}
        <Link href={`/registratsia?next=${encodeURIComponent(next)}`} className="link font-bold text-ink">
          Регистрация
        </Link>
      </p>
    </form>
  );
}
