"use client";

import Script from "next/script";

/** Cloudflare Turnstile widget. Renders nothing unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. */
export function Turnstile() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" async defer />
      {/* the widget adds a hidden "cf-turnstile-response" field to the surrounding form */}
      <div className="cf-turnstile" data-sitekey={siteKey} data-language="bg" />
    </>
  );
}
