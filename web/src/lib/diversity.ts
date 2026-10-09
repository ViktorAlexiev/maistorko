/**
 * Keeps one company from filling a results page: no more than `max` craftsmen of the same company in a row.
 * A third one waits until someone else (or another company) has been shown; the order is otherwise unchanged.
 * Craftsmen without a company are never held back.
 */
export function limitCompanyRuns<T extends { id: string }>(rows: T[], companyOf: Map<string, string>, max = 2): T[] {
  const out: T[] = [];
  const rest = [...rows];
  while (rest.length) {
    const tail = out.slice(-max).map((r) => companyOf.get(r.id));
    const idx = rest.findIndex((r) => {
      const c = companyOf.get(r.id);
      return !(c && tail.length === max && tail.every((t) => t === c));
    });
    out.push(rest.splice(idx === -1 ? 0 : idx, 1)[0]);
  }
  return out;
}
