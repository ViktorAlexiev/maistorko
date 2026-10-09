import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Personal short link: /m/<slug>, and /m/<slug>?s=qr for the QR code.
 * Counts the visit, then sends the visitor to the public profile.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/m/[slug]">) {
  const { slug } = await ctx.params;
  const safe = /^[a-z0-9-]{1,80}$/.test(slug) ? slug : null;
  if (!safe) return new Response(null, { status: 307, headers: { Location: "/maistori", "Cache-Control": "no-store" } });

  const source = request.nextUrl.searchParams.get("s") === "qr" ? "qr" : "link";
  const isPrefetch = request.headers.get("next-router-prefetch") || request.headers.get("purpose") === "prefetch";
  if (!isPrefetch) {
    try {
      const supabase = await createClient();
      await supabase.rpc("record_link_visit", { p_slug: safe, p_source: source });
    } catch {
      // never block the visitor because of a counter
    }
  }
  // Relative redirect: correct behind nginx and the tunnel too
  return new Response(null, { status: 307, headers: { Location: `/maistori/${safe}`, "Cache-Control": "no-store" } });
}
