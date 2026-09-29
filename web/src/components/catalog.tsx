import Link from "next/link";
import { X } from "lucide-react";
import { getCategoryTree, getCities, type CategoryNode } from "@/lib/data";
import { runSearch } from "@/lib/search";
import { PAGE_SIZE, TIME_SLOTS, toQueryString, type SearchState } from "@/lib/search-params";
import { addDaysISO, formatDate, relativeDay } from "@/lib/format";
import { CraftsmanRow } from "@/components/craftsman-row";
import { SearchFilters } from "@/components/search-filters";
import { SortControl } from "@/components/sort-control";
import { EmptyState } from "@/components/bits";
import { RuleLegend } from "@/components/rule-strip";

export async function Catalog({
  state,
  basePath,
  fixedCategory,
}: {
  state: SearchState;
  basePath: string;
  fixedCategory?: CategoryNode;
}) {
  const [tree, cities, result] = await Promise.all([getCategoryTree(), getCities(), runSearch(state)]);
  const fixedSlug = fixedCategory?.slug;
  const allCats = tree.flatMap((p) => [p, ...p.children]);
  const cityName = cities.find((c) => c.slug === state.city)?.name;
  const catName = allCats.find((c) => c.slug === state.category)?.name;
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const href = (patch: Partial<SearchState>) => `${basePath}${toQueryString({ ...state, ...patch }, fixedSlug)}`;

  const chips: { label: string; remove: Partial<SearchState> }[] = [];
  if (state.q) chips.push({ label: `„${state.q}“`, remove: { q: "", page: 1 } });
  if (catName && !fixedCategory) chips.push({ label: catName, remove: { category: "", page: 1 } });
  if (fixedCategory && state.category !== fixedCategory.slug && catName)
    chips.push({ label: catName, remove: { category: fixedCategory.slug, page: 1 } });
  if (cityName) chips.push({ label: cityName, remove: { city: "", page: 1 } });
  if (state.date)
    chips.push({
      label:
        state.dateTo && state.dateTo !== state.date
          ? `${formatDate(state.date)} – ${formatDate(state.dateTo)}`
          : relativeDay(state.date),
      remove: { date: "", dateTo: "", page: 1 },
    });
  if (state.time) chips.push({ label: TIME_SLOTS.find((t) => t.value === state.time)!.label, remove: { time: "", page: 1 } });
  if (state.priceMin || state.priceMax)
    chips.push({
      label: `${state.priceMin ? `от ${state.priceMin} €` : ""}${state.priceMin && state.priceMax ? " " : ""}${state.priceMax ? `до ${state.priceMax} €` : ""}`,
      remove: { priceMin: "", priceMax: "", page: 1 },
    });
  if (state.rating) chips.push({ label: `рейтинг ${state.rating.replace(".", ",")}+`, remove: { rating: "", page: 1 } });
  if (state.verified) chips.push({ label: "проверени", remove: { verified: false, page: 1 } });

  const heading = state.date
    ? `Свободни ${relativeDay(state.date)}${state.dateTo && state.dateTo !== state.date ? ` – ${formatDate(state.dateTo)}` : ""}`
    : "Всички налични";

  return (
    <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10">
      <SearchFilters
        state={state}
        categories={tree}
        cities={cities}
        fixedCategory={fixedCategory}
        total={result.total}
      />

      <section aria-labelledby="results-heading" className="min-w-0">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-ink pb-3">
          <h2 id="results-heading" className="text-lg font-extrabold">
            <span className="numerals mr-1.5 text-3xl">{result.total}</span>
            {result.total === 1 ? "майстор" : "майстори"}
            <span className="font-semibold text-ink-2"> · {heading}</span>
          </h2>
          <div className="ml-auto hidden lg:block">
            <SortControl state={state} fixedCategory={fixedSlug} />
          </div>
        </div>

        {chips.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Активни филтри">
            {chips.map((c) => (
              <li key={c.label}>
                <Link
                  href={href(c.remove)}
                  scroll={false}
                  className="inline-flex min-h-8 items-center gap-1 rounded-full bg-ink px-3 text-sm font-semibold text-white hover:bg-ink-2"
                  aria-label={`Премахни филтър ${c.label}`}
                >
                  {c.label} <X className="size-3.5" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}

        {result.loosened && (
          <p className="mt-4 rounded-[8px] bg-rule-soft px-4 py-3 text-sm">
            Никой не съвпада с всички думи от „{state.q}“. Показваме майстори, които съвпадат с поне една от тях.
          </p>
        )}

        {result.error ? (
          <div className="mt-6">
            <EmptyState title="Търсенето не проработи">
              Опитайте отново след малко. Ако проблемът продължава, махнете някой от филтрите.
            </EmptyState>
          </div>
        ) : result.rows.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              title={state.date ? "Никой не е свободен тогава" : "Няма майстори по тези критерии"}
              action={
                <>
                  {state.date && (
                    <Link href={href({ date: state.date, dateTo: addDaysISO(state.date, 7), page: 1 })} className="btn btn-primary">
                      Разшири до седмица
                    </Link>
                  )}
                  {state.city && (
                    <Link href={href({ city: "", page: 1 })} className="btn btn-outline">
                      Всички градове
                    </Link>
                  )}
                  <Link href={basePath} className="btn btn-outline">
                    Изчисти филтрите
                  </Link>
                </>
              }
            >
              {state.date
                ? "Опитайте друга дата или по-широк период. Много майстори имат свободни дни в следващите седмици."
                : "Опитайте с по-общи думи, друг град или без някой от филтрите."}
            </EmptyState>
          </div>
        ) : (
          <>
            <RuleLegend className="mt-4" />
            <ol className="mt-3 grid gap-3">
              {result.rows.map((c) => (
                <li key={c.id}>
                  <CraftsmanRow c={c} dateQuery={c.matched_date ?? undefined} />
                </li>
              ))}
            </ol>
            {pages > 1 && (
              <nav aria-label="Страници" className="mt-8 flex flex-wrap items-center justify-center gap-2">
                {state.page > 1 && (
                  <Link href={href({ page: state.page - 1 })} className="btn btn-outline" rel="prev">
                    Предишна
                  </Link>
                )}
                {Array.from({ length: pages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === pages || Math.abs(p - state.page) <= 1)
                  .map((p, i, arr) => (
                    <span key={p} className="flex items-center gap-2">
                      {i > 0 && p - arr[i - 1] > 1 && <span className="text-ink-3">…</span>}
                      <Link
                        href={href({ page: p })}
                        aria-current={p === state.page ? "page" : undefined}
                        className={`btn min-w-11 ${p === state.page ? "btn-primary" : "btn-outline"}`}
                      >
                        <span className="numerals text-lg">{p}</span>
                      </Link>
                    </span>
                  ))}
                {state.page < pages && (
                  <Link href={href({ page: state.page + 1 })} className="btn btn-outline" rel="next">
                    Следваща
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  );
}
