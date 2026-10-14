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
      <div className="grid gap-4 sm:auto-rows-fr sm:grid-cols-2 lg:grid-cols-3">
        {tree.map((cat) => (
          <section
            key={cat.id}
            className="relative flex flex-col rounded-lg bg-surface p-5 shadow-[var(--shadow-sm)] transition-[box-shadow,translate] duration-200 ease-[var(--ease-out)] has-[>h2_a:hover]:-translate-y-0.5 has-[>h2_a:hover]:shadow-[var(--shadow-md)]"
          >
            {/* The title link stretches over the whole card; subcategory chips sit above it */}
            <h2 className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-md bg-rule">
                <CategoryIcon name={cat.icon} className="size-6" />
              </span>
              <Link
                href={`/kategorii/${cat.slug}`}
                className="text-xl font-extrabold after:absolute after:inset-0 after:rounded-lg after:content-[''] hover:underline"
              >
                {cat.name}
              </Link>
              <span
                className="numerals ml-auto grid h-8 min-w-8 shrink-0 place-items-center rounded-full bg-paper px-2 text-lg text-ink-2"
                aria-label={`${counts[cat.slug] ?? 0} майстори`}
              >
                {counts[cat.slug] ?? 0}
              </span>
            </h2>
            {cat.description && <p className="mt-3 line-clamp-2 text-sm text-ink-2">{cat.description}</p>}
            <ul className="mt-4 flex flex-wrap gap-2">
              {cat.children.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/kategorii/${cat.slug}?kategoria=${c.slug}`}
                    className="relative inline-flex min-h-10 items-center rounded-full bg-paper px-3.5 text-sm font-semibold text-ink-2 transition-colors hover:bg-rule-soft hover:text-ink"
                  >
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
