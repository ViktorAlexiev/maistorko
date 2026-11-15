"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SCHEDULE_PRESETS, type SchedulePresetId } from "@/lib/schedule-presets";
import { getSetupStatus, type SetupStatus } from "@/lib/setup-status";
import { writeBoxes, type BoxInput } from "@/lib/write-boxes";

export type SetupResult = { ok: true; status: SetupStatus } | { ok: false; message: string };

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect("/vhod");
  return { supabase, id };
}

const OTHER_SLUGS = new Set(["drugo", "drugi-uslugi"]);

const categoriesSchema = z
  .array(z.number().int().positive())
  .min(1, "Изберете поне една категория.")
  .max(20, "Най-много 20 категории.");
const otherServicesSchema = z.string().trim().max(200, "Описанието на „Друго“ е до 200 символа.").optional();
const placeSchema = z.object({
  city: z.string().min(1, "Изберете град."),
  areas: z.array(z.string()).max(40),
});
const presetSchema = z.enum(["weekdays", "monsat", "evenings"]);

async function done(supabase: Awaited<ReturnType<typeof me>>["supabase"], id: string): Promise<SetupResult> {
  revalidatePath("/", "layout");
  return { ok: true, status: await getSetupStatus(supabase, id) };
}

export async function saveSetupCategories(input: { categoryIds: number[]; otherServices: string }): Promise<SetupResult> {
  const { supabase, id } = await me();
  const ids = categoriesSchema.safeParse([...new Set(input.categoryIds)]);
  if (!ids.success) return { ok: false, message: ids.error.issues[0].message };
  const other = otherServicesSchema.safeParse(input.otherServices);
  if (!other.success) return { ok: false, message: other.error.issues[0].message };

  const failed = { ok: false as const, message: "Категориите не бяха записани." };
  const { error: e1 } = await supabase.from("craftsman_categories").delete().eq("craftsman_id", id);
  if (e1) return failed;
  const { error: e2 } = await supabase
    .from("craftsman_categories")
    .insert(ids.data.map((category_id) => ({ craftsman_id: id, category_id })));
  if (e2) return failed;

  // "Какво е „Друго“?" is kept only while an "other services" category is ticked
  const { data: picked } = await supabase.from("categories").select("slug").in("id", ids.data);
  const hasOther = (picked ?? []).some((c) => OTHER_SLUGS.has(c.slug));
  const { error: e3 } = await supabase
    .from("craftsman_profiles")
    .update({ other_services: hasOther ? other.data || null : null })
    .eq("id", id);
  if (e3) return failed;

  return done(supabase, id);
}

export async function saveSetupPlace(input: { city: string; areas: string[] }): Promise<SetupResult> {
  const { supabase, id } = await me();
  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };

  const { data: cities } = await supabase.from("cities").select("id, slug");
  const cityId = (s: string) => cities?.find((c) => c.slug === s)?.id;
  const mainCity = cityId(parsed.data.city);
  if (!mainCity) return { ok: false, message: "Изберете град." };

  // Checked first: a rejected save must not leave the place half-written
  const areaIds = parsed.data.areas.map(cityId).filter((x): x is number => Boolean(x) && x !== mainCity);
  const { data: citiesLimit } = await supabase.rpc("plan_limit", { p_craftsman: id, p_key: "cities" });
  if (citiesLimit != null && areaIds.length + 1 > citiesLimit) {
    return { ok: false, message: `Безплатният план позволява до ${citiesLimit} града с основния. С Pro няма ограничение.` };
  }

  const failed = { ok: false as const, message: "Мястото не беше записано. Опитайте отново." };
  const { error: e1 } = await supabase.from("craftsman_profiles").update({ city_id: mainCity }).eq("id", id);
  if (e1) return failed;
  const { error: e2 } = await supabase.from("profiles").update({ city_id: mainCity }).eq("id", id);
  if (e2) return failed;
  const { error: e3 } = await supabase.from("craftsman_service_areas").delete().eq("craftsman_id", id);
  if (e3) return failed;
  if (areaIds.length) {
    const { error: e4 } = await supabase
      .from("craftsman_service_areas")
      .insert(areaIds.map((city_id) => ({ craftsman_id: id, city_id })));
    if (e4) return failed;
  }

  return done(supabase, id);
}

export async function saveSetupPrices(input: { boxes: BoxInput[] }): Promise<SetupResult> {
  const { supabase, id } = await me();
  const written = await writeBoxes(supabase, id, input.boxes);
  if (!written.ok) return written;
  return done(supabase, id);
}

export async function saveSetupSchedule(input: { preset: SchedulePresetId }): Promise<SetupResult> {
  const { supabase, id } = await me();
  const preset = presetSchema.safeParse(input.preset);
  if (!preset.success) return { ok: false, message: "Графикът не беше записан." };
  const rules = SCHEDULE_PRESETS.find((p) => p.id === preset.data)?.rules;
  if (!rules) return { ok: false, message: "Графикът не беше записан." };

  const failed = { ok: false as const, message: "Графикът не беше записан." };
  const { error: e1 } = await supabase.from("availability_rules").delete().eq("craftsman_id", id);
  if (e1) return failed;
  const { error: e2 } = await supabase
    .from("availability_rules")
    .insert(rules.map((r) => ({ craftsman_id: id, ...r })));
  if (e2) return failed;

  return done(supabase, id);
}
