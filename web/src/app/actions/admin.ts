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

/** Every admin action leaves a line in the audit log (Дневник). */
async function log(
  supabase: Awaited<ReturnType<typeof adminClient>>,
  action: string,
  target: { type: string; id: string },
  details: Record<string, unknown> = {},
) {
  await supabase.rpc("log_admin_action", { p_action: action, p_target_type: target.type, p_target_id: target.id, p_details: details as never });
}

export async function setBanned(userId: string, banned: boolean) {
  const supabase = await adminClient();
  const { error } = await supabase.from("profiles").update({ is_banned: banned }).eq("id", userId);
  if (!error) await log(supabase, banned ? "ban" : "unban", { type: "user", id: userId });
  revalidatePath("/admin");
  revalidatePath("/maistori", "layout");
  return { ok: !error, message: error ? "Неуспешно." : banned ? "Потребителят е блокиран." : "Блокирането е премахнато." };
}

export async function setVerified(userId: string, verified: boolean) {
  const supabase = await adminClient();
  const { error } = await supabase.from("craftsman_profiles").update({ is_verified: verified }).eq("id", userId);
  if (!error) await log(supabase, verified ? "verify" : "unverify", { type: "craftsman", id: userId });
  revalidatePath("/admin");
  revalidatePath("/maistori", "layout");
  return { ok: !error, message: error ? "Неуспешно." : verified ? "Маркиран като проверен." : "Значката е премахната." };
}

export async function setHidden(userId: string, hidden: boolean) {
  const supabase = await adminClient();
  const { error } = await supabase.from("craftsman_profiles").update({ is_hidden: hidden }).eq("id", userId);
  if (!error) await log(supabase, hidden ? "hide" : "unhide", { type: "craftsman", id: userId });
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

export async function setPlan(userId: string, plan: "free" | "pro" | "company", months: number | null) {
  const supabase = await adminClient();
  const until = months ? new Date(Date.now() + months * 30 * 86400_000).toISOString() : null;
  const { error } = await supabase.rpc("admin_set_plan", { p_craftsman: userId, p_plan: plan, p_valid_until: until ?? undefined });
  if (!error) await log(supabase, "set_plan", { type: "craftsman", id: userId }, { plan, months });
  revalidatePath("/admin");
  return { ok: !error, message: error ? "Неуспешно." : plan === "free" ? "Планът е върнат на безплатен." : `Включен е план ${plan === "pro" ? "Pro" : "Фирма"}${months ? ` за ${months} мес.` : ""}.` };
}

export async function setContactStatus(id: string, status: "new" | "talking" | "done" | "rejected", note?: string) {
  const supabase = await adminClient();
  const patch: { status: typeof status; admin_note?: string | null } = { status };
  if (note !== undefined) patch.admin_note = note.trim() || null;
  const { error } = await supabase.from("contact_requests").update(patch).eq("id", id);
  if (!error) await log(supabase, "contact_status", { type: "contact_request", id }, { status });
  revalidatePath("/admin/zapitvaniya");
  return { ok: !error, message: error ? "Неуспешно." : "Записано." };
}

export async function resolveReports(targetUser: string, status: "done" | "dismissed") {
  const supabase = await adminClient();
  const { data: claims } = await supabase.auth.getClaims();
  const { error } = await supabase
    .from("reports")
    .update({ status, handled_by: claims?.claims?.sub ?? null, handled_at: new Date().toISOString() })
    .eq("target_user", targetUser)
    .eq("status", "new");
  if (!error) await log(supabase, status === "done" ? "reports_done" : "reports_dismissed", { type: "user", id: targetUser });
  revalidatePath("/admin/dokladi");
  return { ok: !error, message: error ? "Неуспешно." : status === "done" ? "Докладите са приключени." : "Докладите са отхвърлени." };
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------
export async function createOrganization(name: string, eik: string, city: string) {
  const supabase = await adminClient();
  const { data, error } = await supabase.rpc("admin_create_org", { p_name: name, p_eik: eik || undefined, p_city: city || undefined });
  if (error) return { ok: false as const, message: error.message.includes("check") ? "Невалиден ЕИК (9 до 13 цифри)." : error.message };
  const org = data as { id: string; slug: string; owner_token: string };
  await log(supabase, "org_create", { type: "organization", id: org.id }, { name });
  revalidatePath("/admin/firmi");
  return { ok: true as const, message: "Фирмата е създадена.", slug: org.slug, token: org.owner_token };
}

export async function updateOrganization(
  id: string,
  patch: { verified?: boolean; hidden?: boolean; planStatus?: "active" | "paused" },
) {
  const supabase = await adminClient();
  const { error } = await supabase.rpc("admin_update_org", {
    p_org: id,
    p_verified: patch.verified,
    p_hidden: patch.hidden,
    p_plan_status: patch.planStatus,
  });
  if (!error) await log(supabase, "org_update", { type: "organization", id }, patch);
  revalidatePath("/admin/firmi");
  revalidatePath("/firmi", "layout");
  return { ok: !error, message: error ? "Неуспешно." : "Записано." };
}

export async function newOwnerInvite(id: string) {
  const supabase = await adminClient();
  const { data, error } = await supabase.rpc("admin_owner_invite", { p_org: id });
  if (!error) await log(supabase, "org_owner_invite", { type: "organization", id });
  return error || !data
    ? { ok: false as const, message: "Неуспешно." }
    : { ok: true as const, message: "Нов линк за собственика.", token: data as string };
}

export async function setOrganizationOwner(id: string, email: string) {
  const supabase = await adminClient();
  const { error } = await supabase.rpc("admin_set_org_owner", { p_org: id, p_email: email });
  if (!error) await log(supabase, "org_set_owner", { type: "organization", id }, { email });
  revalidatePath("/admin/firmi");
  return { ok: !error, message: error ? error.message : "Собственикът е добавен." };
}
