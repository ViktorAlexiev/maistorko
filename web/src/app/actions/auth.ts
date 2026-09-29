"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrors,
  forgotSchema,
  loginSchema,
  newPasswordSchema,
  registerSchema,
  type FieldErrors,
} from "@/lib/validation";

/** `id` carries a created record back to the client, e.g. the new conversation opened in the chat window. */
export type FormState = { ok?: boolean; message?: string; errors?: FieldErrors; values?: Record<string, string>; id?: string };

function safeNext(next: FormDataEntryValue | null, fallback = "/tabla") {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : fallback;
}

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function signIn(_: FormState, formData: FormData): Promise<FormState> {
  const raw = { email: String(formData.get("email") ?? ""), password: String(formData.get("password") ?? "") };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: { email: raw.email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message =
      error.code === "invalid_credentials"
        ? "Грешен имейл или парола."
        : error.code === "email_not_confirmed"
          ? "Потвърдете имейла си от писмото, което изпратихме."
          : "Входът не успя. Опитайте отново след малко.";
    return { message, values: { email: raw.email } };
  }
  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_: FormState, formData: FormData): Promise<FormState> {
  const raw = {
    role: String(formData.get("role") ?? "client"),
    fullName: String(formData.get("fullName") ?? ""),
    city: String(formData.get("city") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    terms: formData.get("terms") ?? undefined,
  };
  const values = { role: raw.role, fullName: raw.fullName, city: raw.city, email: raw.email };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName, role: parsed.data.role, city: parsed.data.city },
      emailRedirectTo: `${siteUrl()}/auth/callback?next=/tabla`,
    },
  });
  if (error) {
    const message =
      error.code === "user_already_exists" || error.code === "email_exists"
        ? "Вече има профил с този имейл. Влезте или възстановете паролата си."
        : error.code === "weak_password"
          ? "Паролата е твърде слаба. Изберете по-дълга парола."
          : "Регистрацията не успя. Опитайте отново.";
    return { message, values };
  }
  if (!data.session) {
    return { ok: true, message: "Изпратихме ви имейл за потвърждение. Отворете линка в него, за да влезете." };
  }
  revalidatePath("/", "layout");
  redirect(parsed.data.role === "craftsman" ? "/tabla?nov=1" : safeNext(formData.get("next")));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const raw = { email: String(formData.get("email") ?? "") };
  const parsed = forgotSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/nova-parola`,
  });
  // Same answer whether or not the address exists.
  return {
    ok: true,
    message: "Ако има профил с този имейл, ще получите линк за нова парола до няколко минути.",
  };
}

export async function updatePassword(_: FormState, formData: FormData): Promise<FormState> {
  const raw = { password: String(formData.get("password") ?? ""), confirm: String(formData.get("confirm") ?? "") };
  const parsed = newPasswordSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return {
      message:
        error.code === "same_password"
          ? "Новата парола трябва да е различна от старата."
          : "Паролата не беше сменена. Линкът може да е изтекъл: поискайте нов.",
    };
  }
  redirect("/tabla?parola=1");
}
