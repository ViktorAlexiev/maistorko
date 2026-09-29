import type { Metadata } from "next";
import { requireCraftsman } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PricingForm, type Initial } from "./pricing-form";
import { ServicesEditor } from "./services-editor";

export const metadata: Metadata = { title: "Цени и услуги", robots: { index: false } };

export default async function PricesPage() {
  const viewer = await requireCraftsman();
  const supabase = await createClient();
  const [{ data: cp }, { data: services }, { data: links }] = await Promise.all([
    supabase
      .from("craftsman_profiles")
      .select("hourly_rate, callout_fee, travel_fee, materials_included, quote_on_inspection, inspection_policy, inspection_fee, terms_note")
      .eq("id", viewer.id)
      .single(),
    supabase
      .from("services")
      .select("id, name, description, price_kind, price, unit, category_id, sort")
      .eq("craftsman_id", viewer.id)
      .order("sort"),
    supabase
      .from("craftsman_categories")
      .select("category:categories(id, name, parent_id, parent:parent_id(id, name))")
      .eq("craftsman_id", viewer.id),
  ]);

  const cats = (links ?? [])
    .map((l) => (Array.isArray(l.category) ? l.category[0] : l.category))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  // Price guidance per top-level category, computed from existing profiles
  const tops = new Map<number, string>();
  for (const c of cats) {
    const parent = Array.isArray(c.parent) ? c.parent[0] : c.parent;
    tops.set(parent?.id ?? c.id, parent?.name ?? c.name);
  }
  const guides = await Promise.all(
    [...tops.entries()].map(async ([id, name]) => {
      const { data } = await supabase.rpc("category_price_guide", { p_category: id });
      return { id, name, g: data?.[0] };
    }),
  );

  return (
    <div className="grid gap-10">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Цени и услуги</h1>
        <p className="mt-2 max-w-2xl text-lg text-ink-2">
          Клиентите виждат началната ти цена в търсенето и целия ценоразпис в профила. Ясните цени носят повече
          запитвания.
        </p>
      </div>

      {guides.some((x) => x.g && (x.g.hourly_count > 0 || x.g.job_count > 0)) && (
        <section aria-labelledby="guide-heading" className="rounded-[10px] bg-rule-soft p-5">
          <h2 id="guide-heading" className="text-lg font-extrabold">
            Обичайни цени в твоите категории
          </h2>
          <p className="mt-1 text-sm text-ink-2">Изчислени от профилите на други майстори в Майсторко. Само за ориентир.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {guides
              .filter((x) => x.g && (x.g.hourly_count > 0 || x.g.job_count > 0))
              .map(({ id, name, g }) => (
                <li key={id} className="rounded-[8px] bg-surface p-3">
                  <p className="font-bold">{name}</p>
                  {g!.hourly_count > 0 && (
                    <p className="text-sm">
                      На час: <span className="numerals text-lg">{g!.hourly_p25}–{g!.hourly_p75} €</span>{" "}
                      <span className="text-ink-3">(средно {g!.hourly_median} €, {g!.hourly_count} майстори)</span>
                    </p>
                  )}
                  {g!.job_count > 0 && (
                    <p className="text-sm">
                      На услуга: <span className="numerals text-lg">{g!.job_p25}–{g!.job_p75} €</span>{" "}
                      <span className="text-ink-3">(средно {g!.job_median} €)</span>
                    </p>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}

      <PricingForm
        initial={{
          hourlyRate: cp?.hourly_rate != null ? String(cp.hourly_rate) : "",
          calloutFee: cp?.callout_fee != null ? String(cp.callout_fee) : "",
          travelFee: cp?.travel_fee != null ? String(cp.travel_fee) : "",
          materialsIncluded: cp?.materials_included ?? false,
          quoteOnInspection: cp?.quote_on_inspection ?? false,
          inspectionPolicy: (cp?.inspection_policy ?? "") as Initial["inspectionPolicy"],
          inspectionFee: cp?.inspection_fee != null ? String(cp.inspection_fee) : "",
          termsNote: cp?.terms_note ?? "",
        }}
      />

      <ServicesEditor
        userId={viewer.id}
        initial={(services ?? []).map((s) => ({ ...s, price: s.price != null ? String(s.price) : "" }))}
        categories={cats.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
