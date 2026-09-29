import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type Viewer = {
  id: string;
  email: string;
  profile: Profile;
  craftsmanSlug: string | null;
};

/** The signed-in user with their profile, or null. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;

  const [{ data: profile }, { data: craftsman }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", claims.sub).maybeSingle(),
    supabase.from("craftsman_profiles").select("slug").eq("id", claims.sub).maybeSingle(),
  ]);
  if (!profile) return null;

  return {
    id: claims.sub,
    email: (claims.email as string) ?? "",
    profile,
    craftsmanSlug: craftsman?.slug ?? null,
  };
});

export async function requireViewer(next = "/tabla") {
  const viewer = await getViewer();
  if (!viewer) redirect(`/vhod?next=${encodeURIComponent(next)}`);
  return viewer;
}

export async function requireCraftsman() {
  const viewer = await requireViewer();
  if (!viewer.craftsmanSlug) redirect("/tabla");
  return viewer;
}

export async function requireAdmin() {
  const viewer = await requireViewer("/admin");
  if (viewer.profile.role !== "admin" || viewer.profile.is_banned) redirect("/");
  return viewer;
}
