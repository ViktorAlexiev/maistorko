import "server-only";
import { headers } from "next/headers";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|viber|telegram|curl|wget|headless|lighthouse/i;

/** True for crawlers and link-preview fetchers, so counters only reflect people. */
export async function isBot() {
  const h = await headers();
  if (h.get("purpose") === "prefetch" || h.get("next-router-prefetch")) return true;
  return BOT.test(h.get("user-agent") ?? "");
}
