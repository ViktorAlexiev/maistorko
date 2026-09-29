import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type City = { id: number; slug: string; name: string; region: string; is_major: boolean };
export type Category = {
  id: number;
  parent_id: number | null;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort: number;
};
export type CategoryNode = Category & { children: Category[] };

export const getCities = cache(async (): Promise<City[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("cities")
    .select("id, slug, name, region, is_major")
    .order("sort");
  return data ?? [];
});

export const getCategoryTree = cache(async (): Promise<CategoryNode[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, parent_id, slug, name, description, icon, sort")
    .eq("is_active", true)
    .order("sort")
    .order("name");
  const all = data ?? [];
  return all
    .filter((c) => c.parent_id === null)
    .map((p) => ({ ...p, children: all.filter((c) => c.parent_id === p.id) }));
});

/** Number of publicly listed craftsmen per top-level category slug. */
export const getCategoryCounts = cache(async (): Promise<Record<string, number>> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("category_counts");
  return Object.fromEntries((data ?? []).map((r) => [r.slug, r.craftsmen]));
});

export function photoUrl(path: string) {
  if (path.startsWith("/") || path.startsWith("http")) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/work-photos/${path}`;
}
