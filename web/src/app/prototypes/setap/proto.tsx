"use client";

import type { City } from "@/lib/data";
import { useSetupDemo, type Tree } from "./shared";
import { VariantFokus } from "./variant-fokus";

/** The approved variant „Фокус“ of the setup (docs/plans/2026-11-14-setap.md). */
export function SetapProto({
  tree,
  cities,
  stapka,
  demo: demoParam,
}: {
  tree: Tree;
  cities: City[];
  stapka?: string;
  demo?: string;
}) {
  const demo = useSetupDemo(tree, cities, { stapka, demo: demoParam });
  return <VariantFokus demo={demo} />;
}
