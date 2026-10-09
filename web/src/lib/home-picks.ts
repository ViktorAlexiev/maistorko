import type { CraftsmanCardData } from "@/components/craftsman-row";

const isNewcomer = (r: CraftsmanCardData) =>
  r.created_at != null && Date.now() - new Date(r.created_at).getTime() < 60 * 86400_000 && r.rating_count < 3;

/**
 * Three craftsmen for the home page from the ranked list: different trades first, so the page is not three
 * painters, and one place for a newcomer when there is one (so a new craftsman is not stuck behind veterans).
 */
export function pickForHome(rows: CraftsmanCardData[], count = 3): CraftsmanCardData[] {
  const picked: CraftsmanCardData[] = [];
  const trades = new Set<string>();
  for (const r of rows) {
    const trade = r.category_names?.[0] ?? "";
    if (!trades.has(trade)) {
      picked.push(r);
      trades.add(trade);
    }
    if (picked.length === count) break;
  }
  for (const r of rows) {
    if (picked.length >= count) break;
    if (!picked.includes(r)) picked.push(r);
  }
  if (picked.length === count && !picked.some(isNewcomer)) {
    const n = rows.find((r) => isNewcomer(r) && !picked.includes(r));
    if (n) picked[count - 1] = n;
  }
  return picked;
}
