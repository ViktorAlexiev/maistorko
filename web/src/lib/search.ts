import "server-only";
import { createClient } from "@/lib/supabase/server";
import { toRpcArgs, type SearchState } from "@/lib/search-params";
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
  const { data, error } = await supabase.rpc("search_craftsmen", toRpcArgs(s));
  if (error) return { rows: [], total: 0, loosened: false, error: error.message };

  let rows = (data ?? []) as CraftsmanCardData[];
  let total = Number((data?.[0] as { total_count?: number } | undefined)?.total_count ?? 0);
  let loosened = false;

  if (total === 0 && s.q.trim().split(/\s+/).length > 1) {
    const retry = await supabase.rpc("search_craftsmen", toRpcArgs(s, true));
    if (!retry.error && retry.data?.length) {
      rows = retry.data as CraftsmanCardData[];
      total = Number((retry.data[0] as { total_count?: number }).total_count ?? 0);
      loosened = true;
    }
  }
  return { rows, total, loosened };
}
