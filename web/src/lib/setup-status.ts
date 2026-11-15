import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type SetupStatus = {
  hasCategory: boolean; // at least one row in craftsman_categories
  hasArea: boolean; // at least one row in craftsman_service_areas
  hasPrice: boolean; // rpc craftsman_has_price
  hasSchedule: boolean; // at least one row in availability_rules
  listed: boolean; // rpc craftsman_is_listed
  hidden: boolean; // craftsman_profiles.is_hidden
};

/** What the craftsman already has of the search rule. */
export async function getSetupStatus(supabase: SupabaseClient<Database>, id: string): Promise<SetupStatus> {
  const [cats, areas, rules, price, listed, profile] = await Promise.all([
    supabase.from("craftsman_categories").select("category_id", { count: "exact", head: true }).eq("craftsman_id", id),
    supabase.from("craftsman_service_areas").select("city_id", { count: "exact", head: true }).eq("craftsman_id", id),
    supabase.from("availability_rules").select("id", { count: "exact", head: true }).eq("craftsman_id", id),
    supabase.rpc("craftsman_has_price", { p_id: id }),
    supabase.rpc("craftsman_is_listed", { p_id: id }),
    supabase.from("craftsman_profiles").select("is_hidden").eq("id", id).maybeSingle(),
  ]);
  return {
    hasCategory: (cats.count ?? 0) > 0,
    hasArea: (areas.count ?? 0) > 0,
    hasPrice: price.data === true,
    hasSchedule: (rules.count ?? 0) > 0,
    listed: listed.data === true,
    hidden: profile.data?.is_hidden === true,
  };
}
