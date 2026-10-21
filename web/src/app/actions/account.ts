"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FormState } from "@/app/actions/auth";

const DELETE_WORD = "ИЗТРИЙ";

/** Remove every file under `<bucket>/<folder>/` (one level, as the app stores them). */
async function wipeFolder(admin: ReturnType<typeof createAdminClient>, bucket: string, folder: string) {
  for (let guard = 0; guard < 20; guard++) {
    const { data } = await admin.storage.from(bucket).list(folder, { limit: 1000 });
    if (!data?.length) return;
    await admin.storage.from(bucket).remove(data.map((f) => `${folder}/${f.name}`));
    if (data.length < 1000) return;
  }
}

/**
 * GDPR erasure: the person types a confirmation word, then the account, the profile and everything that belongs to it
 * (conversations, orders, offers, reviews they wrote) is removed by the database cascade, and the files are removed here.
 */
export async function deleteAccount(_: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect("/vhod");
  if (String(formData.get("confirm") ?? "").trim().toLocaleUpperCase("bg") !== DELETE_WORD) {
    return { message: `Напишете думата ${DELETE_WORD}, за да потвърдите.` };
  }

  try {
    const admin = createAdminClient();
    await wipeFolder(admin, "avatars", id);
    await wipeFolder(admin, "work-photos", id);
    // client photos sit two folders deep (<uploader>/<client>/<file>), so remove them by their recorded paths
    const { data: clientPhotos } = await admin.from("client_photos").select("path").eq("craftsman_id", id);
    if (clientPhotos?.length) await admin.storage.from("client-photos").remove(clientPhotos.map((p) => p.path));
    const { data: convs } = await admin.from("conversations").select("id").or(`client_id.eq.${id},craftsman_id.eq.${id}`);
    for (const c of convs ?? []) await wipeFolder(admin, "chat-photos", c.id);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return { message: "Не успяхме да изтрием профила. Опитайте пак или ни пишете." };
  } catch {
    return { message: "Не успяхме да изтрием профила. Опитайте пак или ни пишете." };
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/?profil=iztrit");
}
