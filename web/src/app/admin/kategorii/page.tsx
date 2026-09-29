import { createClient } from "@/lib/supabase/server";
import { CategoryAdmin } from "./category-admin";

export default async function AdminCategoriesPage() {
  const supabase = await createClient();
  const [{ data: cats }, { data: links }] = await Promise.all([
    supabase.from("categories").select("id, parent_id, slug, name, description, icon, keywords, sort, is_active").order("sort").order("name"),
    supabase.from("craftsman_categories").select("category_id"),
  ]);
  const usage: Record<number, number> = {};
  for (const l of links ?? []) usage[l.category_id] = (usage[l.category_id] ?? 0) + 1;

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Категории</h1>
        <p className="mt-2 text-ink-2">
          Дървото категория → подкатегория. Ключовите думи помагат на търсенето да разпознава как хората описват работата.
        </p>
      </div>
      <CategoryAdmin categories={cats ?? []} usage={usage} />
    </div>
  );
}
