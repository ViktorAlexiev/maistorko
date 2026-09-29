"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { categorySchema, fieldErrors } from "@/lib/validation";
import type { FormState } from "@/app/actions/auth";

async function adminClient() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_admin");
  if (!data) throw new Error("Нямате администраторски права.");
  return supabase;
}

export async function setBanned(userId: string, banned: boolean) {
  const supabase = await adminClient();
  const { error } = await supabase.from("profiles").update({ is_banned: banned }).eq("id", userId);
  revalidatePath("/admin");
  revalidatePath("/maistori", "layout");
  return { ok: !error, message: error ? "Неуспешно." : banned ? "Потребителят е блокиран." : "Блокирането е премахнато." };
}

export async function setVerified(userId: string, verified: boolean) {
  const supabase = await adminClient();
  const { error } = await supabase.from("craftsman_profiles").update({ is_verified: verified }).eq("id", userId);
  revalidatePath("/admin");
  revalidatePath("/maistori", "layout");
  return { ok: !error, message: error ? "Неуспешно." : verified ? "Маркиран като проверен." : "Значката е премахната." };
}

export async function setHidden(userId: string, hidden: boolean) {
  const supabase = await adminClient();
  const { error } = await supabase.from("craftsman_profiles").update({ is_hidden: hidden }).eq("id", userId);
  revalidatePath("/admin");
  revalidatePath("/maistori", "layout");
  return { ok: !error, message: error ? "Неуспешно." : hidden ? "Профилът е скрит." : "Профилът е видим." };
}

export async function saveCategory(_: FormState, formData: FormData): Promise<FormState> {
  const supabase = await adminClient();
  const id = String(formData.get("id") ?? "");
  const raw = {
    name: String(formData.get("name") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    parentId: String(formData.get("parentId") ?? ""),
    description: String(formData.get("description") ?? ""),
    keywords: String(formData.get("keywords") ?? ""),
    sort: String(formData.get("sort") ?? "100"),
    isActive: formData.get("isActive") === "on",
  };
  const values = { ...raw, isActive: raw.isActive ? "on" : "" };
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  const d = parsed.data;
  if (id && d.parentId === id) return { errors: { parentId: "Категорията не може да е родител на себе си." }, values };

  const row = {
    name: d.name,
    slug: d.slug,
    parent_id: d.parentId ? Number(d.parentId) : null,
    description: d.description || null,
    keywords: (d.keywords ?? "")
      .split(",")
      .map((k) => k.trim().toLowerCase())
      .filter(Boolean),
    sort: d.sort,
    is_active: d.isActive,
  };
  const { error } = id
    ? await supabase.from("categories").update(row).eq("id", Number(id))
    : await supabase.from("categories").insert(row);
  if (error) {
    return {
      message: error.code === "23505" ? "Вече има категория с този адрес (slug)." : "Категорията не беше записана.",
      values,
    };
  }
  revalidatePath("/", "layout");
  return { ok: true, message: id ? "Категорията е обновена." : "Категорията е добавена." };
}

export async function deleteCategory(id: number) {
  const supabase = await adminClient();
  const { count } = await supabase
    .from("craftsman_categories")
    .select("craftsman_id", { count: "exact", head: true })
    .eq("category_id", id);
  if ((count ?? 0) > 0) {
    return { ok: false, message: `Използва се от ${count} майстори. Скрийте я вместо да я триете.` };
  }
  const { error } = await supabase.from("categories").delete().eq("id", id);
  revalidatePath("/", "layout");
  return { ok: !error, message: error ? "Категорията не беше изтрита." : "Категорията е изтрита." };
}
