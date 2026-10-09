import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { todayISO } from "@/lib/format";

/**
 * Seed for the "Препоръчани" tie-break. Derived from the visitor (address and browser) and the day, then thrown
 * away: nothing is stored and no cookie is set. One visitor sees a stable order all day (paging works), and
 * different visitors see different orders, so close scores take turns.
 */
export async function rankSeed(scope = "") {
  const h = await headers();
  const ip = (h.get("cf-connecting-ip") ?? h.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const ua = h.get("user-agent") ?? "";
  return createHash("sha256").update(`${ip}|${ua}|${todayISO()}|${scope}`).digest("hex").slice(0, 16);
}
