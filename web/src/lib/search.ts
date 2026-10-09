import "server-only";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isBot } from "@/lib/bots";
import { rankSeed } from "@/lib/rank-seed";
import { limitCompanyRuns } from "@/lib/diversity";
import { PAGE_SIZE, toRpcArgs, type SearchState } from "@/lib/search-params";
import type { CraftsmanCardData } from "@/components/craftsman-row";

export type SearchResult = {
  rows: CraftsmanCardData[];
  total: number;
  /** true when no craftsman matched every word and we fell back to "any word" */
  loosened: boolean;
  error?: string;
};

export async function runSearch(s: SearchState): Promise<SearchResult> {
  const supabase = await createClient();
  const seed = await rankSeed();
  const { data, error } = await supabase.rpc("search_craftsmen", { ...toRpcArgs(s), p_seed: seed });
  if (error) return { rows: [], total: 0, loosened: false, error: error.message };

  let rows = (data ?? []) as CraftsmanCardData[];
  let total = Number((data?.[0] as { total_count?: number } | undefined)?.total_count ?? 0);
  let loosened = false;

  if (total === 0 && s.q.trim().split(/\s+/).length > 1) {
    const retry = await supabase.rpc("search_craftsmen", { ...toRpcArgs(s, true), p_seed: seed });
    if (!retry.error && retry.data?.length) {
      rows = retry.data as CraftsmanCardData[];
      total = Number((retry.data[0] as { total_count?: number }).total_count ?? 0);
      loosened = true;
    }
  }
  // "Препоръчани": at most two craftsmen of one company in a row, so a company cannot fill the page
  if (s.sort === "recommended" && rows.length > 2) {
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id, organization_id")
      .in("user_id", rows.map((r) => r.id));
    if (members?.length) rows = limitCompanyRuns(rows, new Map(members.map((m) => [m.user_id, m.organization_id])));
  }

  // Count the appearances (people only), after the response is sent
  if (rows.length && !(await isBot())) {
    const ids = rows.map((r) => r.id);
    after(async () => {
      await supabase.rpc("record_impressions", { p_ids: ids, p_offset: (s.page - 1) * PAGE_SIZE });
    });
  }
  return { rows, total, loosened };
}
