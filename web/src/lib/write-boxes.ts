import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/database.types";
import type { PriceUnit } from "@/lib/format";
import type { BoxKind } from "@/lib/prices";
import { boxSchema, toMoney } from "@/lib/validation";

export type BoxInput = { categoryId: number; kind: BoxKind; price: string; unit: PriceUnit };

/** Saves the price boxes. Shared by the setup page and "Цени и услуги"; never deletes boxes. */
export async function writeBoxes(
  supabase: SupabaseClient<Database>,
  id: string,
  boxes: BoxInput[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = z.array(boxSchema).safeParse(boxes);
  if (!parsed.success) return { ok: false, message: "Цените не бяха записани. Провери сумите." };

  // Every box must belong to a subcategory the craftsman has ticked
  const ids = [...new Set(parsed.data.map((b) => b.categoryId))];
  if (ids.length) {
    const [{ data: mine }, { data: leaves }] = await Promise.all([
      supabase.from("craftsman_categories").select("category_id").eq("craftsman_id", id).in("category_id", ids),
      supabase.from("categories").select("id").in("id", ids).not("parent_id", "is", null),
    ]);
    const ticked = new Set((mine ?? []).map((r) => r.category_id));
    const leafIds = new Set((leaves ?? []).map((r) => r.id));
    if (ids.some((c) => !ticked.has(c) || !leafIds.has(c))) {
      return { ok: false, message: "Категориите в профила са сменени. Презареди страницата." };
    }
  }

  if (parsed.data.length) {
    const now = new Date().toISOString();
    const { error } = await supabase.from("category_prices").upsert(
      parsed.data.map((b) => ({
        craftsman_id: id,
        category_id: b.categoryId,
        kind: b.kind,
        price: b.kind === "quote" ? null : toMoney(b.price),
        unit: b.kind === "hour" ? ("hour" as const) : b.kind === "quote" ? ("job" as const) : b.unit,
        updated_at: now,
      })),
      { onConflict: "craftsman_id,category_id" },
    );
    if (error) return { ok: false, message: "Цените не бяха записани. Опитайте отново." };
  }
  return { ok: true };
}
