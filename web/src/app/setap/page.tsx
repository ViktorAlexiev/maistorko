import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCategoryTree, getCities } from "@/lib/data";
import { getMyPlan } from "@/lib/plan";
import type { PriceUnit } from "@/lib/format";
import type { BoxKind } from "@/lib/prices";
import { matchPreset } from "@/lib/schedule-presets";
import { getSetupStatus } from "@/lib/setup-status";
import type { BoardBox } from "@/app/tabla/tseni/prices-board";
import { SetupFlow } from "./setup-flow";

export const metadata: Metadata = { title: "Първи стъпки", robots: { index: false } };

export default async function SetupPage({ searchParams }: PageProps<"/setap">) {
  const viewer = await requireViewer("/setap");
  if (!viewer.craftsmanSlug) redirect("/tabla");
  const sp = await searchParams;
  const supabase = await createClient();

  const status = await getSetupStatus(supabase, viewer.id);
  if (sp.ot === "pokana" && status.listed) redirect("/tabla");

  const plan = await getMyPlan();
  const [tree, cities, { data: cats }, { data: cp }, { data: areas }, { data: priceRows }, { data: rules }] = await Promise.all([
    getCategoryTree(),
    getCities(),
    supabase.from("craftsman_categories").select("category_id").eq("craftsman_id", viewer.id),
    supabase.from("craftsman_profiles").select("other_services, city_id").eq("id", viewer.id).maybeSingle(),
    supabase.from("craftsman_service_areas").select("city_id").eq("craftsman_id", viewer.id),
    supabase.from("category_prices").select("category_id, kind, price, unit").eq("craftsman_id", viewer.id),
    supabase.from("availability_rules").select("weekday, start_time, end_time").eq("craftsman_id", viewer.id),
  ]);

  const cityOf = (id: number | null) => cities.find((c) => c.id === id)?.slug ?? "";
  const names = new Map(tree.flatMap((t) => [t, ...t.children]).map((c) => [c.id, c.name]));
  const boxes: Record<number, BoardBox> = {};
  for (const r of priceRows ?? []) {
    const name = names.get(r.category_id);
    if (name == null) continue;
    boxes[r.category_id] = {
      id: r.category_id,
      name,
      kind: r.kind as BoxKind,
      price: r.price != null ? String(r.price) : "",
      unit: (r.unit ?? "job") as PriceUnit,
    };
  }

  const n = Number(typeof sp.stapka === "string" ? sp.stapka : "");
  const step = Number.isInteger(n) && n >= 1 && n <= 5 ? (n as 1 | 2 | 3 | 4 | 5) : 1;
  const city = cityOf(cp?.city_id ?? null);

  return (
    <SetupFlow
      initial={{
        step,
        tree,
        cities,
        maxAreas: plan.limits.cities != null ? Math.max(plan.limits.cities - 1, 0) : null,
        categoryIds: (cats ?? []).map((c) => c.category_id),
        otherServices: cp?.other_services ?? "",
        city,
        areas: (areas ?? []).map((a) => cityOf(a.city_id)).filter((s) => s && s !== city),
        boxes,
        schedule: matchPreset(rules ?? []),
        status,
        slug: viewer.craftsmanSlug,
      }}
    />
  );
}
