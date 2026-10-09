import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { rankSeed } from "@/lib/rank-seed";
import { CraftsmanRow, type CraftsmanCardData } from "@/components/craftsman-row";
import { VerifiedBadge } from "@/components/bits";
import { RuleLegend } from "@/components/rule-strip";

const getOrg = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("id, slug, name, eik, description, phone, is_verified, is_hidden, city:city_id(name)")
    .eq("slug", slug)
    .maybeSingle();
  return data;
});

export async function generateMetadata({ params }: PageProps<"/firmi/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const org = await getOrg(slug);
  if (!org || org.is_hidden) return { title: "Фирмата не е намерена" };
  return {
    title: `${org.name}: майстори по свободни дни`,
    description: org.description?.slice(0, 160) ?? `Майсторите на ${org.name} и кога са свободни.`,
    alternates: { canonical: `/firmi/${org.slug}` },
  };
}

export default async function CompanyPublicPage({ params }: PageProps<"/firmi/[slug]">) {
  const { slug } = await params;
  const org = await getOrg(slug);
  if (!org || org.is_hidden) notFound();

  const supabase = await createClient();
  // only listed craftsmen are visible through RLS
  const { data: members } = await supabase.from("organization_members").select("user_id").eq("organization_id", org.id);
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: rows } = ids.length
    ? await supabase.rpc("search_craftsmen", { p_ids: ids, p_sort: "recommended", p_limit: 48, p_seed: await rankSeed(`firma-${org.id}`) })
    : { data: [] };
  const city = Array.isArray(org.city) ? org.city[0] : org.city;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <nav aria-label="Път" className="mb-5 text-sm text-ink-3">
        <Link href="/maistori" className="link">
          Майстори
        </Link>
        {" / "}
        <span>Фирми</span>
      </nav>
      <header className="border-b border-ink pb-8">
        <h1 className="display flex flex-wrap items-center gap-x-3 text-5xl sm:text-7xl">
          {org.name}
          {org.is_verified && (
            <span className="text-3xl">
              <VerifiedBadge />
            </span>
          )}
        </h1>
        <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-ink-2">
          {city?.name && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4" aria-hidden /> {city.name}
            </span>
          )}
          {org.eik && <span>ЕИК {org.eik}</span>}
          {org.is_verified && <VerifiedBadge withLabel />}
        </p>
        {org.description && <p className="mt-4 max-w-[68ch] whitespace-pre-line text-lg leading-relaxed">{org.description}</p>}
      </header>

      <section aria-labelledby="team" className="mt-8">
        <h2 id="team" className="display text-4xl">
          Майстори във фирмата
        </h2>
        {!rows?.length ? (
          <p className="mt-3 text-ink-2">Майсторите на фирмата още не са публикували профилите си.</p>
        ) : (
          <>
            <RuleLegend className="mt-3" />
            <ol className="stagger mt-3 grid gap-3">
              {(rows as CraftsmanCardData[]).map((c) => (
                <li key={c.id}>
                  <CraftsmanRow c={c} />
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </div>
  );
}
