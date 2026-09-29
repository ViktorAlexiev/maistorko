import type { Metadata } from "next";
import { Catalog } from "@/components/catalog";
import { getCategoryTree, getCities } from "@/lib/data";
import { parseSearch } from "@/lib/search-params";

export async function generateMetadata({ searchParams }: PageProps<"/maistori">): Promise<Metadata> {
  const s = parseSearch(await searchParams);
  const [cities, tree] = await Promise.all([getCities(), getCategoryTree()]);
  const city = cities.find((c) => c.slug === s.city)?.name;
  const cat = tree.flatMap((p) => [p, ...p.children]).find((c) => c.slug === s.category)?.name;
  const title = [cat ?? "Майстори", city ? `в ${city}` : ""].filter(Boolean).join(" ");
  return {
    title,
    description: `${title}: цени, свободни дни и отзиви. Изберете майстор и му пишете директно.`,
    alternates: { canonical: `/maistori${s.city ? `?grad=${s.city}` : ""}` },
  };
}

export default async function CraftsmenPage({ searchParams }: PageProps<"/maistori">) {
  const state = parseSearch(await searchParams);
  const cities = await getCities();
  const city = cities.find((c) => c.slug === state.city)?.name;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="display mb-6 text-5xl sm:text-6xl">{city ? `Майстори в ${city}` : "Майстори"}</h1>
      <Catalog state={state} basePath="/maistori" />
    </div>
  );
}
