"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  clientProfileSchema,
  craftsmanProfileSchema,
  fieldErrors,
  pricingSchema,
  toMoney,
} from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

async function me() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect("/vhod");
  return { supabase, id };
}

export async function confirmCalendar(): Promise<{ ok: boolean; message: string }> {
  const { supabase } = await me();
  const { error } = await supabase.rpc("confirm_calendar");
  revalidatePath("/tabla", "layout");
  return error
    ? { ok: false, message: "Не успяхме да потвърдим графика. Опитайте отново." }
    : { ok: true, message: "Графикът е потвърден. Клиентите виждат, че е актуален." };
}

export async function becomeCraftsman() {
  const { supabase } = await me();
  const { error } = await supabase.rpc("become_craftsman");
  if (error) redirect("/tabla?greshka=maistor");
  revalidatePath("/", "layout");
  redirect("/tabla/profil?nov=1");
}

export async function updateClientProfile(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, id } = await me();
  const raw = {
    fullName: String(formData.get("fullName") ?? ""),
    city: String(formData.get("city") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  };
  const parsed = clientProfileSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  const { data: city } = parsed.data.city
    ? await supabase.from("cities").select("id").eq("slug", parsed.data.city).maybeSingle()
    : { data: null };
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, city_id: city?.id ?? null, phone: parsed.data.phone || null })
    .eq("id", id);
  if (error) return { message: "Промените не бяха записани. Опитайте отново.", values: raw };
  revalidatePath("/", "layout");
  return { ok: true, message: "Профилът е обновен." };
}

export async function updateCraftsmanProfile(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, id } = await me();
  const raw = {
    displayName: String(formData.get("displayName") ?? ""),
    businessName: String(formData.get("businessName") ?? ""),
    bio: String(formData.get("bio") ?? ""),
    years: String(formData.get("years") ?? ""),
    city: String(formData.get("city") ?? ""),
    areas: formData.getAll("areas").map(String),
    categories: formData.getAll("categories").map(String),
    languages: formData.getAll("languages").map(String),
    contactHours: String(formData.get("contactHours") ?? ""),
    otherServices: String(formData.get("otherServices") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    phoneVisibility: String(formData.get("phoneVisibility") ?? "login"),
  };
  const values = {
    displayName: raw.displayName,
    businessName: raw.businessName,
    bio: raw.bio,
    years: raw.years,
    city: raw.city,
    contactHours: raw.contactHours,
    otherServices: raw.otherServices,
    phone: raw.phone,
  };
  const parsed = craftsmanProfileSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const d = parsed.data;

  const { data: cities } = await supabase.from("cities").select("id, slug");
  const cityId = (s: string) => cities?.find((c) => c.slug === s)?.id;
  const mainCity = cityId(d.city);
  if (!mainCity) return { errors: { city: "Изберете град." }, values };

  const { error: e1 } = await supabase
    .from("craftsman_profiles")
    .update({
      display_name: d.displayName,
      business_name: d.businessName || null,
      bio: d.bio ?? "",
      years_experience: d.years === "" ? null : Number(d.years),
      city_id: mainCity,
      languages: d.languages,
      contact_hours: d.contactHours || null,
      phone_visibility: d.phoneVisibility,
      other_services: d.otherServices || null,
    })
    .eq("id", id);
  if (e1) return { message: "Профилът не беше записан. Опитайте отново.", values };

  await supabase.from("profiles").update({ full_name: d.displayName, city_id: mainCity, phone: d.phone || null }).eq("id", id);

  // Replace categories and service areas
  const catIds = d.categories.map(Number).filter(Number.isFinite);
  await supabase.from("craftsman_categories").delete().eq("craftsman_id", id);
  if (catIds.length) {
    const { error } = await supabase
      .from("craftsman_categories")
      .insert(catIds.map((category_id) => ({ craftsman_id: id, category_id })));
    if (error) return { message: "Категориите не бяха записани.", values };
  }
  const areaIds = d.areas.map(cityId).filter((x): x is number => Boolean(x) && x !== mainCity);
  await supabase.from("craftsman_service_areas").delete().eq("craftsman_id", id);
  if (areaIds.length) {
    await supabase.from("craftsman_service_areas").insert(areaIds.map((city_id) => ({ craftsman_id: id, city_id })));
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Профилът е записан." };
}

export async function updatePricing(_: FormState, formData: FormData): Promise<FormState> {
  const { supabase, id } = await me();
  const raw = {
    hourlyRate: String(formData.get("hourlyRate") ?? ""),
    calloutFee: String(formData.get("calloutFee") ?? ""),
    travelFee: String(formData.get("travelFee") ?? ""),
    materialsIncluded: formData.get("materialsIncluded") === "on",
    quoteOnInspection: formData.get("quoteOnInspection") === "on",
    inspectionPolicy: String(formData.get("inspectionPolicy") ?? "") as "" | "free" | "paid" | "deducted" | "none",
    inspectionFee: String(formData.get("inspectionFee") ?? ""),
    termsNote: String(formData.get("termsNote") ?? ""),
  };
  const values = {
    hourlyRate: raw.hourlyRate,
    calloutFee: raw.calloutFee,
    travelFee: raw.travelFee,
    inspectionPolicy: raw.inspectionPolicy,
    inspectionFee: raw.inspectionFee,
    termsNote: raw.termsNote,
  };
  const parsed = pricingSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const hourly = toMoney(parsed.data.hourlyRate);
  if (hourly !== null && (hourly < 1 || hourly > 1000)) {
    return { errors: { hourlyRate: "Цената на час е между 1 и 1000 €." }, values };
  }
  const { error } = await supabase
    .from("craftsman_profiles")
    .update({
      hourly_rate: hourly,
      callout_fee: toMoney(parsed.data.calloutFee),
      travel_fee: toMoney(parsed.data.travelFee),
      materials_included: parsed.data.materialsIncluded,
      quote_on_inspection: parsed.data.quoteOnInspection,
      inspection_policy: parsed.data.inspectionPolicy || null,
      inspection_fee:
        parsed.data.inspectionPolicy === "paid" || parsed.data.inspectionPolicy === "deducted"
          ? toMoney(parsed.data.inspectionFee)
          : null,
      terms_note: parsed.data.termsNote || null,
    })
    .eq("id", id);
  if (error) return { message: "Цените не бяха записани. Опитайте отново.", values };
  revalidatePath("/", "layout");
  return { ok: true, message: "Цените са записани." };
}
