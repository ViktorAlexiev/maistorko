/**
 * Public demo mode (`NEXT_PUBLIC_SUPABASE_SAME_ORIGIN=1`): the browser reaches Supabase through the
 * site's own origin, where nginx proxies /rest, /auth, /storage and /realtime. The server keeps using
 * NEXT_PUBLIC_SUPABASE_URL directly. The tunnel address can then change without a rebuild.
 */
export const SAME_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_SAME_ORIGIN === "1";

/** Fixed auth cookie name, so the browser and the server share one session even with different Supabase URLs. */
export const cookieOptions = { name: "sb-maistorko-auth-token" };

export function browserSupabaseUrl() {
  return SAME_ORIGIN ? window.location.origin : process.env.NEXT_PUBLIC_SUPABASE_URL!;
}

/** Base for public Storage URLs: relative in demo mode so it works on any host. */
export const storageBase = SAME_ORIGIN ? "" : process.env.NEXT_PUBLIC_SUPABASE_URL;

/** Stored Storage URLs carry the host they were uploaded through; re-base them on the current one. */
export function publicStorageUrl(url: string) {
  const i = url.indexOf("/storage/v1/object/public/");
  return i >= 0 ? `${storageBase}${url.slice(i)}` : url;
}
