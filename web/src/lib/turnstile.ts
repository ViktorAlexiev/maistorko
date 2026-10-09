import "server-only";
import { headers } from "next/headers";

/**
 * Cloudflare Turnstile check for sign-up, sign-in and password reset.
 * Active only when both keys are set (NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY);
 * without them the forms work as before, so local development needs nothing.
 */
export async function verifyTurnstile(formData: FormData): Promise<string | null> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return null;

  const token = String(formData.get("cf-turnstile-response") ?? "");
  if (!token) return "Потвърдете, че не сте робот, и опитайте пак.";

  const h = await headers();
  const ip = (h.get("cf-connecting-ip") ?? h.get("x-forwarded-for") ?? "").split(",")[0].trim();
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success ? null : "Проверката не мина. Опитайте пак.";
  } catch {
    return "Проверката не успя. Опитайте пак след малко.";
  }
}
