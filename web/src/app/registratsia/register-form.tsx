"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { signUp, type FormState } from "@/app/actions/auth";
import { FieldError, FormMessage, SubmitButton } from "@/components/submit-button";
import { Turnstile } from "@/components/turnstile";

type City = { slug: string; name: string; region: string; is_major: boolean };

export function RegisterForm({
  role: initialRole,
  cities,
  next,
  onRoleChange,
}: {
  role: "client" | "craftsman";
  cities: City[];
  next: string;
  onRoleChange?: (role: "client" | "craftsman") => void;
}) {
  const [state, action] = useActionState<FormState, FormData>(signUp, {});
  const [role, setRole] = useState<"client" | "craftsman">((state.values?.role as "client" | "craftsman") ?? initialRole);
  useEffect(() => {
    onRoleChange?.(role);
  }, [role, onRoleChange]);
  // React resets the form after every action, which puts the hidden radios back to their first value: put them back on the chosen role
  const picks = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    picks.current?.querySelectorAll<HTMLInputElement>('input[name="role-pick"]').forEach((r) => {
      r.checked = r.value === role;
    });
  }, [state, role]);
  const majors = cities.filter((c) => c.is_major);
  const regions = Array.from(new Set(cities.filter((c) => !c.is_major).map((c) => c.region)));

  if (state.ok) {
    return <FormMessage state={state} />;
  }

  return (
    <form action={action} className="grid gap-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {/* the role is sent from the state: React resets the form after a failed attempt, which would flip the radios back */}
      <input type="hidden" name="role" value={role} />
      <fieldset ref={picks}>
        <legend className="label">Регистрирам се като</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["client", "Клиент", "търся майстор"],
              ["craftsman", "Майстор", "предлагам услуги"],
            ] as const
          ).map(([value, label, sub]) => (
            <label
              key={value}
              className={`flex cursor-pointer flex-col rounded-[8px] border-[1.5px] px-4 py-3 transition-colors ${
                role === value ? "border-ink bg-rule" : "border-line-strong bg-surface hover:border-ink"
              }`}
            >
              <input
                type="radio"
                name="role-pick"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
                className="sr-only"
              />
              <span className="text-lg font-extrabold">{label}</span>
              <span className="text-sm text-ink-2">{sub}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="fullName" className="label">
          {role === "craftsman" ? "Име или име на фирмата" : "Име"}
        </label>
        <input
          id="fullName"
          name="fullName"
          autoComplete="name"
          required
          className="field"
          defaultValue={state.values?.fullName}
          aria-invalid={Boolean(state.errors?.fullName)}
          aria-describedby={state.errors?.fullName ? "fullName-err" : undefined}
        />
        <FieldError id="fullName-err" message={state.errors?.fullName} />
      </div>

      <div>
        <label htmlFor="city" className="label">
          Град
        </label>
        <select
          id="city"
          name="city"
          className="field"
          defaultValue={state.values?.city ?? ""}
          aria-invalid={Boolean(state.errors?.city)}
          aria-describedby={state.errors?.city ? "city-err" : undefined}
        >
          <option value="" disabled>
            Изберете град
          </option>
          {majors.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
          {regions.map((r) => (
            <optgroup key={r} label={`Област ${r}`}>
              {cities
                .filter((c) => !c.is_major && c.region === r)
                .map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <FieldError id="city-err" message={state.errors?.city} />
      </div>

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
          required
          className="field"
          defaultValue={state.values?.email}
          aria-invalid={Boolean(state.errors?.email)}
          aria-describedby={state.errors?.email ? "email-err" : undefined}
        />
        <FieldError id="email-err" message={state.errors?.email} />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Парола
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
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
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" name="terms" className="check mt-0.5" aria-invalid={Boolean(state.errors?.terms)} />
          <span className="text-ink-2">
            Съгласен съм данните ми да се използват за работата на профила. Телефонът ми не се показва публично.
          </span>
        </label>
        <FieldError id="terms-err" message={state.errors?.terms} />
      </div>

      <Turnstile />
      <FormMessage state={state} />
      <SubmitButton className="btn btn-primary btn-lg w-full" pendingText="Създаваме профила…">
        {role === "craftsman" ? "Създай профил на майстор" : "Създай профил"}
      </SubmitButton>
      <p className="text-center text-ink-2">
        Вече имате профил?{" "}
        <Link href={`/vhod?next=${encodeURIComponent(next)}`} className="link font-bold text-ink">
          Вход
        </Link>
      </p>
    </form>
  );
}
