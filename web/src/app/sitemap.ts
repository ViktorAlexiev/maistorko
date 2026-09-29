import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  // Anonymous client: only publicly listed data ends up in the sitemap.
  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const [{ data: craftsmen }, { data: cats }, { data: cities }] = await Promise.all([
    supabase.from("craftsman_profiles").select("slug, updated_at").eq("is_hidden", false).limit(5000),
    supabase.from("categories").select("slug").is("parent_id", null).eq("is_active", true),
    supabase.from("cities").select("slug").eq("is_major", true),
  ]);
  return [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/maistori`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/kategorii`, changeFrequency: "weekly", priority: 0.7 },
    ...(cities ?? []).map((c) => ({ url: `${base}/maistori?grad=${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...(cats ?? []).map((c) => ({ url: `${base}/kategorii/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...(craftsmen ?? []).map((c) => ({
      url: `${base}/maistori/${c.slug}`,
      lastModified: c.updated_at,
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
  ];
}
