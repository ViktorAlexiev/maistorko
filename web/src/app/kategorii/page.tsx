import type { Metadata } from "next";
import Link from "next/link";
import { getCategoryCounts, getCategoryTree } from "@/lib/data";
import { CategoryIcon } from "@/components/category-icon";
import { PageHeading } from "@/components/bits";

export const metadata: Metadata = {
  title: "Категории майстори",
  description: "Всички видове услуги: електро, ВиК, боя, плочки, климатици, ключари, хамали и още.",
};

export default async function CategoriesPage() {
  const [tree, counts] = await Promise.all([getCategoryTree(), getCategoryCounts()]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeading title="Категории">Изберете вида работа, после филтрирайте по град и дата.</PageHeading>
      <div className="columns-1 gap-8 sm:columns-2 lg:columns-3">
        {tree.map((cat) => (
          <section key={cat.id} className="mb-8 break-inside-avoid border-t-[1.5px] border-ink pt-4">
            <h2 className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-[8px] bg-rule ring-1 ring-inset ring-ink/40">
                <CategoryIcon name={cat.icon} />
              </span>
              <Link href={`/kategorii/${cat.slug}`} className="text-xl font-extrabold hover:underline">
                {cat.name}
              </Link>
              <span className="numerals ml-auto text-xl text-ink-3" aria-label={`${counts[cat.slug] ?? 0} майстори`}>
                {counts[cat.slug] ?? 0}
              </span>
            </h2>
            {cat.description && <p className="mt-2 text-sm text-ink-2">{cat.description}</p>}
            <ul className="mt-3 grid gap-1">
              {cat.children.map((c) => (
                <li key={c.id}>
                  <Link href={`/kategorii/${cat.slug}?kategoria=${c.slug}`} className="link text-ink-2 hover:text-ink">
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
