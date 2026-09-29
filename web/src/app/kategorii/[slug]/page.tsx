import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryTree } from "@/lib/data";
import { parseSearch } from "@/lib/search-params";
import { Catalog } from "@/components/catalog";
import { CategoryIcon } from "@/components/category-icon";

async function findCategory(slug: string) {
  const tree = await getCategoryTree();
  return tree.find((c) => c.slug === slug);
}

export async function generateMetadata({ params }: PageProps<"/kategorii/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const cat = await findCategory(slug);
  if (!cat) return { title: "Категорията не е намерена" };
  return {
    title: `${cat.name}: майстори, цени и свободни дни`,
    description: `${cat.description ?? cat.name} Вижте цените и свободните дни на майсторите и им пишете директно.`,
    alternates: { canonical: `/kategorii/${cat.slug}` },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps<"/kategorii/[slug]">) {
  const { slug } = await params;
  const cat = await findCategory(slug);
  if (!cat) notFound();

  const raw = await searchParams;
  const sub = typeof raw.kategoria === "string" ? raw.kategoria : "";
  const fixed = cat.children.some((c) => c.slug === sub) ? sub : cat.slug;
  const state = parseSearch(raw, fixed);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <nav aria-label="Път" className="mb-3 text-sm text-ink-3">
        <Link href="/kategorii" className="link">
          Категории
        </Link>{" "}
        / <span className="text-ink-2">{cat.name}</span>
      </nav>
      <div className="mb-8 flex items-start gap-4">
        <span className="mt-1 hidden size-14 shrink-0 place-items-center rounded-[10px] bg-rule ring-1 ring-inset ring-ink/40 sm:grid">
          <CategoryIcon name={cat.icon} className="size-7" />
        </span>
        <div>
          <h1 className="display text-5xl sm:text-6xl">{cat.name}</h1>
          {cat.description && <p className="mt-2 max-w-2xl text-lg text-ink-2">{cat.description}</p>}
        </div>
      </div>
      <Catalog state={state} basePath={`/kategorii/${cat.slug}`} fixedCategory={cat} />
    </div>
  );
}
