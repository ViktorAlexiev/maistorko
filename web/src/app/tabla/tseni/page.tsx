import type { Metadata } from "next";
import { requireCraftsman } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyPlan, hasFeature } from "@/lib/plan";
import type { PriceUnit } from "@/lib/format";
import type { BoxKind } from "@/lib/prices";
import type { TermsInput } from "@/app/actions/dashboard";
import { PricesBoard, type BoardBox, type BoardGroup, type BoardHint } from "./prices-board";
import { ServicesEditor } from "./services-editor";
import { TemplatePicker, type Range, type Template } from "./template-picker";

export const metadata: Metadata = { title: "Цени и услуги", robots: { index: false } };

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export default async function PricesPage() {
  const viewer = await requireCraftsman();
  const supabase = await createClient();
  const plan = await getMyPlan();
  const [{ data: cp }, { data: services }, { data: links }, { data: priceRows }] = await Promise.all([
    supabase
      .from("craftsman_profiles")
      .select("callout_fee, travel_fee, materials_included, quote_on_inspection, inspection_policy, inspection_fee, terms_note, city:cities(slug, name)")
      .eq("id", viewer.id)
      .single(),
    supabase
      .from("services")
      .select("id, name, description, price_kind, price, unit, category_id, sort, template_id")
      .eq("craftsman_id", viewer.id)
      .order("sort"),
    supabase
      .from("craftsman_categories")
      .select("category:categories(id, name, slug, sort, parent_id, parent:parent_id(id, name, slug, sort))")
      .eq("craftsman_id", viewer.id),
    supabase.from("category_prices").select("category_id, kind, price, unit").eq("craftsman_id", viewer.id),
  ]);

  const cats = (links ?? []).map((l) => one(l.category)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  // Ready-made typical jobs of the top-level categories he works in
  const topSlugs = new Map<string, string>();
  for (const c of cats) {
    const parent = one(c.parent);
    topSlugs.set(parent?.slug ?? c.slug, parent?.name ?? c.name);
  }
  const { data: tplRows } = topSlugs.size
    ? await supabase.from("job_templates").select("id, name, unit, category_slug").in("category_slug", [...topSlugs.keys()]).order("category_slug").order("sort")
    : { data: [] };
  const templates = (tplRows ?? []) as Template[];
  const proHints = hasFeature(plan, "price_hints");
  const city = one(cp?.city);
  const { data: rangeRows } =
    proHints && templates.length
      ? await supabase.rpc("template_price_ranges", { p_templates: templates.map((t) => t.id), p_city: city?.slug ?? undefined })
      : { data: [] };
  const ranges: Record<number, Range> = Object.fromEntries(
    (rangeRows ?? []).map((r) => [r.template_id, { p25: Number(r.p25), p75: Number(r.p75), scope: r.scope as Range["scope"] }]),
  );

  // One box per ticked subcategory (a ticked top-level category has no box), grouped under its top-level category
  const priceOf = new Map((priceRows ?? []).map((r) => [r.category_id, r]));
  const topMap = new Map<number, { id: number; name: string; sort: number; boxes: { sort: number; box: BoardBox }[] }>();
  for (const c of cats) {
    const parent = one(c.parent);
    if (c.parent_id == null || !parent) continue;
    const row = priceOf.get(c.id);
    const box: BoardBox = {
      id: c.id,
      name: c.name,
      kind: (row?.kind ?? null) as BoxKind | null,
      price: row?.price != null ? String(row.price) : "",
      unit: (row?.unit ?? "job") as PriceUnit,
    };
    const top = topMap.get(parent.id) ?? { id: parent.id, name: parent.name, sort: parent.sort, boxes: [] };
    top.boxes.push({ sort: c.sort, box });
    topMap.set(parent.id, top);
  }
  const tops = [...topMap.values()].sort((a, b) => a.sort - b.sort || a.id - b.id);
  const hints = proHints
    ? await Promise.all(
        tops.map(async (t) => {
          const { data } = await supabase.rpc("category_price_hint", { p_category: t.id });
          const g = data?.[0];
          if (!g) return null;
          const hint: BoardHint = {
            hourly: g.hourly_p25 != null ? [Number(g.hourly_p25), Number(g.hourly_p75)] : null,
            job: g.job_p25 != null ? [Number(g.job_p25), Number(g.job_p75)] : null,
            scope: g.scope === "city" ? "city" : "all",
          };
          return hint;
        }),
      )
    : tops.map(() => null);
  const groups: BoardGroup[] = tops.map((t, i) => ({
    id: t.id,
    name: t.name,
    boxes: t.boxes.sort((a, b) => a.sort - b.sort || a.box.id - b.box.id).map((x) => x.box),
    hint: hints[i],
  }));

  const terms: TermsInput = {
    callout: cp?.callout_fee != null ? String(cp.callout_fee) : "",
    travel: cp?.travel_fee != null ? String(cp.travel_fee) : "",
    materials: cp?.materials_included ?? false,
    quoteOnInspection: cp?.quote_on_inspection ?? false,
    policy: (cp?.inspection_policy ?? "") as TermsInput["policy"],
    inspectionFee: cp?.inspection_fee != null ? String(cp.inspection_fee) : "",
    note: cp?.terms_note ?? "",
  };

  return (
    <PricesBoard
      groups={groups}
      terms={terms}
      cityName={city?.name ?? null}
      proHints={proHints}
      limit={plan.limits.services ?? null}
      used={(services ?? []).length}
    >
      <TemplatePicker
        userId={viewer.id}
        templates={templates}
        categoryNames={Object.fromEntries(topSlugs)}
        taken={(services ?? []).map((s) => s.template_id).filter((x): x is number => x != null)}
        ranges={ranges}
        isPro={proHints}
      />

      <ServicesEditor
        userId={viewer.id}
        initial={(services ?? []).map((s) => ({ ...s, price: s.price != null ? String(s.price) : "" }))}
        categories={cats.map((c) => ({ id: c.id, name: c.name }))}
        limit={plan.limits.services ?? null}
      />
    </PricesBoard>
  );
}
