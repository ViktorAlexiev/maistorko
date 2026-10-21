"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "@/app/actions/auth";

/**
 * DEMO ONLY. Lets any craftsman switch his own Pro plan on or off with one button, so people can try every feature
 * without a payment. It does nothing unless the server has DEMO_PRO_BUTTON=1; in a real launch leave that unset
 * and plans are given only by an admin or by payment.
 */
export async function setDemoPlan(_: FormState, formData: FormData): Promise<FormState> {
  if (process.env.DEMO_PRO_BUTTON !== "1") return { message: "Тази функция не е включена." };

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return { message: "Влезте в профила си." };
  const { data: craftsman } = await supabase.from("craftsman_profiles").select("id").eq("id", id).maybeSingle();
  if (!craftsman) return { message: "Само майстор може да активира Pro." };

  const admin = createAdminClient();
  // a plan from a company is not touched
  const { data: current } = await admin.from("craftsman_subscriptions").select("source").eq("craftsman_id", id).maybeSingle();
  if (current?.source === "company") return { message: "Планът ти е от фирмата и не се променя оттук." };

  if (formData.get("plan") === "free") {
    await admin.from("craftsman_subscriptions").delete().eq("craftsman_id", id);
    revalidatePath("/tabla", "layout");
    return { ok: true, message: "Върнат е безплатният план." };
  }

  const { error } = await admin
    .from("craftsman_subscriptions")
    .upsert({ craftsman_id: id, plan: "pro", status: "active", valid_until: null, source: "admin", note: "демо бутон" }, { onConflict: "craftsman_id" });
  if (error) return { message: "Не успяхме да включим Pro. Опитай пак." };
  revalidatePath("/tabla", "layout");
  return { ok: true, message: "Pro е включен. Разгледай „Клиенти“, „Оферти“ и „Статистика“." };
}
