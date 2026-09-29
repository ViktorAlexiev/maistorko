"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, messageSchema, reviewSchema } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

export async function startConversation(_: FormState, formData: FormData): Promise<FormState> {
  const craftsmanId = String(formData.get("craftsmanId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const date = String(formData.get("date") ?? "");
  // "work" is either a priced service ("s:<uuid>") or a picked category ("c:<id>")
  const work = String(formData.get("work") ?? "");
  const service = /^s:[0-9a-f-]{36}$/.test(work) ? work.slice(2) : undefined;
  const category = /^c:\d+$/.test(work) ? Number(work.slice(2)) : undefined;
  const slot = String(formData.get("slot") ?? "");
  const inline = formData.get("inline") === "1";
  const raw = { body: String(formData.get("body") ?? "") };
  const values = { body: raw.body, date, work };

  const parsed = messageSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { errors: { date: "Невалидна дата." }, values };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    const back = `/maistori/${slug}${date ? `?data=${date}` : ""}#pishi`;
    redirect(`/vhod?next=${encodeURIComponent(back)}`);
  }

  const { data, error } = await supabase.rpc("start_conversation", {
    p_craftsman: craftsmanId,
    p_body: parsed.data.body,
    p_date: date || undefined,
    p_category: category,
    p_service: service,
    p_slot: date && ["morning", "afternoon", "evening"].includes(slot) ? slot : undefined,
  });
  if (error || !data) {
    return { message: error?.message ?? "Съобщението не беше изпратено. Опитайте отново.", values };
  }
  revalidatePath("/saobshtenia");
  // The chat window on the profile keeps the user on the page and switches to the conversation
  if (inline) return { ok: true, id: data };
  redirect(`/saobshtenia/${data}`);
}

export async function submitReview(_: FormState, formData: FormData): Promise<FormState> {
  const craftsmanId = String(formData.get("craftsmanId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const raw = { rating: formData.get("rating") ?? "", body: String(formData.get("body") ?? "") };
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: { body: raw.body } };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub;
  if (!me) return { message: "Влезте в профила си, за да оставите отзив." };

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("craftsman_id", craftsmanId)
    .eq("client_id", me)
    .maybeSingle();

  const payload = { rating: parsed.data.rating, body: parsed.data.body ?? "" };
  const { error } = existing
    ? await supabase.from("reviews").update(payload).eq("id", existing.id)
    : await supabase.from("reviews").insert({ ...payload, craftsman_id: craftsmanId, client_id: me });

  if (error) {
    return {
      message:
        error.code === "42501"
          ? "Можете да оцените майстор, след като сте си писали и той ви е отговорил."
          : "Отзивът не беше записан. Опитайте отново.",
      values: { body: raw.body },
    };
  }
  revalidatePath(`/maistori/${slug}`);
  return { ok: true, message: existing ? "Отзивът е обновен." : "Благодарим! Отзивът е публикуван." };
}

export async function deleteReview(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const supabase = await createClient();
  await supabase.from("reviews").delete().eq("id", id);
  revalidatePath(`/maistori/${slug}`);
}

export async function toggleSaved(craftsmanId: string, save: boolean): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = claims?.claims?.sub;
  if (!me) return { ok: false, message: "login" };
  const { error } = save
    ? await supabase.from("saved_craftsmen").upsert({ client_id: me, craftsman_id: craftsmanId })
    : await supabase.from("saved_craftsmen").delete().eq("client_id", me).eq("craftsman_id", craftsmanId);
  if (error) return { ok: false, message: "Неуспешно. Опитайте отново." };
  revalidatePath("/tabla/zapazeni");
  return { ok: true };
}
