import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const isProd = process.env.NODE_ENV === "production";
const turnstile = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? "https://challenges.cloudflare.com" : "";

/** Origin of the Supabase API plus its websocket twin, for Realtime. Empty in same-origin demo mode ('self' covers it). */
function supabaseOrigins() {
  if (!supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_SAME_ORIGIN === "1") return "";
  const u = new URL(supabaseUrl);
  const ws = u.protocol === "https:" ? "wss:" : "ws:";
  return `${u.origin} ${ws}//${u.host}`;
}

/**
 * Content Security Policy. Next.js writes small inline bootstrap scripts, so script-src has to allow
 * 'unsafe-inline'; the policy still blocks scripts from other origins, framing, plugins and form hijacking.
 */
function csp() {
  const supabase = supabaseOrigins();
  const parts = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' ${isProd ? "" : "'unsafe-eval'"} ${turnstile}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseUrl ? new URL(supabaseUrl).origin : ""}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${turnstile}`.replace(/\s+/g, " ").trim(),
    turnstile ? `frame-src ${turnstile}` : "frame-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];
  return parts.join("; ");
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp() },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS only where the site really is served over HTTPS
  ...(siteUrl.startsWith("https://") ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
