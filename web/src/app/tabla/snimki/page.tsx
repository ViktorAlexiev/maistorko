import type { Metadata } from "next";
import { requireCraftsman } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { photoUrl } from "@/lib/data";
import { PhotoManager } from "./photo-manager";

export const metadata: Metadata = { title: "Снимки", robots: { index: false } };

export default async function PhotosPage() {
  const viewer = await requireCraftsman();
  const supabase = await createClient();
  const { data } = await supabase
    .from("work_photos")
    .select("id, path, caption, sort")
    .eq("craftsman_id", viewer.id)
    .order("sort");

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Снимки от работа</h1>
        <p className="mt-2 max-w-2xl text-lg text-ink-2">
          Покажи завършени обекти. Добрите снимки (светли, от цялото помещение) носят повече доверие.
        </p>
      </div>
      <PhotoManager
        userId={viewer.id}
        initial={(data ?? []).map((p) => ({ ...p, url: photoUrl(p.path) }))}
      />
    </div>
  );
}
