"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { addDaysISO, isoWeekday, todayISO } from "@/lib/format";
import { SORTS, TIME_SLOTS, toQueryString, type SearchState } from "@/lib/search-params";

type Cat = { slug: string; name: string; children: { slug: string; name: string }[] };
type City = { slug: string; name: string; region: string; is_major: boolean };

type Props = {
  state: SearchState;
  categories: Cat[];
  cities: City[];
  /** On a category page the category is fixed; show its subcategories instead */
  fixedCategory?: Cat;
  total: number;
};

export function SearchFilters({ state, categories, cities, fixedCategory, total }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const sheet = useRef<HTMLDialogElement>(null);
  const [s, setS] = useState(state);
  const [prevState, setPrevState] = useState(state);
  if (prevState !== state) {
    setPrevState(state);
    setS(state);
  }

  const today = todayISO();
  const tomorrow = addDaysISO(today, 1);
  const sat = addDaysISO(today, (6 - isoWeekday(today) + 7) % 7);
  const sun = addDaysISO(sat, 1);

  function navigate(next: SearchState) {
    startTransition(() => {
      router.replace(`${pathname}${toQueryString(next, fixedCategory?.slug)}`, { scroll: false });
    });
  }

  function update(patch: Partial<SearchState>, apply = true) {
    const next = { ...s, ...patch, page: 1 };
    setS(next);
    if (apply) navigate(next);
  }

  function clearAll() {
    const next: SearchState = {
      ...s,
      q: "",
      category: fixedCategory ? s.category : "",
      city: "",
      date: "",
      dateTo: "",
      time: "",
      priceMin: "",
      priceMax: "",
      rating: "",
      verified: false,
      page: 1,
    };
    setS(next);
    navigate(next);
  }

  const majors = cities.filter((c) => c.is_major);
  const regions = Array.from(new Set(cities.filter((c) => !c.is_major).map((c) => c.region)));

  const body = (
    <div className="grid gap-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: s.q });
        }}
      >
        <label htmlFor="f-q" className="label">
          Какво търсите?
        </label>
        <div className="flex gap-2">
          <input
            id="f-q"
            className="field"
            value={s.q}
            onChange={(e) => setS({ ...s, q: e.target.value })}
            placeholder="напр. смяна на бойлер"
            enterKeyHint="search"
          />
          <button type="submit" className="btn btn-primary shrink-0 px-3.5">
            Търси
          </button>
        </div>
      </form>

      {fixedCategory ? (
        fixedCategory.children.length > 0 && (
          <fieldset>
            <legend className="label">Вид работа</legend>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="chip"
                aria-pressed={s.category === fixedCategory.slug}
                onClick={() => update({ category: fixedCategory.slug })}
              >
                Всички
              </button>
              {fixedCategory.children.map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  className="chip"
                  aria-pressed={s.category === c.slug}
                  onClick={() => update({ category: c.slug })}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </fieldset>
        )
      ) : (
        <div>
          <label htmlFor="f-cat" className="label">
            Категория
          </label>
          <select id="f-cat" className="field" value={s.category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">Всички категории</option>
            {categories.map((p) => (
              <optgroup key={p.slug} label={p.name}>
                <option value={p.slug}>{p.name}: всичко</option>
                {p.children.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      <div>
        <label htmlFor="f-city" className="label">
          Град или район
        </label>
        <select id="f-city" className="field" value={s.city} onChange={(e) => update({ city: e.target.value })}>
          <option value="">Всички градове</option>
          {majors.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
          {regions.map((r) => (
            <optgroup key={r} label={`Област ${r}`}>
              {cities
                .filter((c) => !c.is_major && c.region === r)
                .map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <p className="hint">Показваме и майстори, които пътуват до този град.</p>
      </div>

      <fieldset>
        <legend className="label">Кога ви трябва?</legend>
        <div className="flex flex-wrap gap-2">
          {[
            ["Днес", today, today],
            ["Утре", tomorrow, tomorrow],
            ["Уикенда", sat, sun],
          ].map(([label, from, to]) => {
            const on = s.date === from && (s.dateTo || s.date) === to;
            return (
              <button
                key={label}
                type="button"
                className="chip"
                aria-pressed={on}
                onClick={() => update(on ? { date: "", dateTo: "" } : { date: from, dateTo: to === from ? "" : to })}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="f-from" className="text-sm font-semibold text-ink-2">
              От дата
            </label>
            <input
              id="f-from"
              type="date"
              min={today}
              className="field mt-1"
              value={s.date}
              onChange={(e) => update({ date: e.target.value, dateTo: s.dateTo && s.dateTo < e.target.value ? "" : s.dateTo })}
            />
          </div>
          <div>
            <label htmlFor="f-to" className="text-sm font-semibold text-ink-2">
              До дата
            </label>
            <input
              id="f-to"
              type="date"
              min={s.date || today}
              max={s.date ? addDaysISO(s.date, 30) : undefined}
              disabled={!s.date}
              className="field mt-1"
              value={s.dateTo}
              onChange={(e) => update({ dateTo: e.target.value })}
            />
          </div>
        </div>
        <p className="hint">Показваме само майстори, свободни поне един от тези дни.</p>
      </fieldset>

      <fieldset>
        <legend className="label">Час от деня</legend>
        <div className="grid grid-cols-3 gap-2">
          {TIME_SLOTS.map((t) => (
            <button
              key={t.value}
              type="button"
              className="chip flex-col gap-0 px-2 py-1.5 leading-tight"
              aria-pressed={s.time === t.value}
              onClick={() => update({ time: s.time === t.value ? "" : t.value })}
            >
              <span>{t.label}</span>
              <span className="text-[0.75rem] font-medium opacity-75">{t.hours}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Цена (начална, €)</legend>
        <form
          className="grid grid-cols-[1fr_1fr_auto] items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            update({ priceMin: s.priceMin, priceMax: s.priceMax });
          }}
        >
          <div>
            <label htmlFor="f-pmin" className="sr-only">
              Цена от
            </label>
            <input
              id="f-pmin"
              inputMode="decimal"
              className="field"
              placeholder="от"
              value={s.priceMin}
              onChange={(e) => setS({ ...s, priceMin: e.target.value.replace(/[^\d.]/g, "") })}
              onBlur={() => update({ priceMin: s.priceMin, priceMax: s.priceMax })}
            />
          </div>
          <div>
            <label htmlFor="f-pmax" className="sr-only">
              Цена до
            </label>
            <input
              id="f-pmax"
              inputMode="decimal"
              className="field"
              placeholder="до"
              value={s.priceMax}
              onChange={(e) => setS({ ...s, priceMax: e.target.value.replace(/[^\d.]/g, "") })}
              onBlur={() => update({ priceMin: s.priceMin, priceMax: s.priceMax })}
            />
          </div>
          <button type="submit" className="btn btn-outline px-3">
            OK
          </button>
        </form>
        <p className="hint">Сравнява началната цена от профила (на час или на услуга).</p>
      </fieldset>

      <fieldset>
        <legend className="label">Рейтинг</legend>
        <div className="flex flex-wrap gap-2">
          {[
            ["", "Всички"],
            ["3", "3+"],
            ["4", "4+"],
            ["4.5", "4,5+"],
          ].map(([v, label]) => (
            <button key={v} type="button" className="chip" aria-pressed={s.rating === v} onClick={() => update({ rating: v })}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-center gap-3 font-semibold">
        <input type="checkbox" className="check" checked={s.verified} onChange={(e) => update({ verified: e.target.checked })} />
        Само проверени майстори
      </label>

      <button type="button" className="btn btn-ghost justify-start px-0 underline underline-offset-4" onClick={clearAll}>
        Изчисти всички филтри
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop: sticky sidebar */}
      <aside aria-label="Филтри" className="hidden lg:block">
        <div className="sticky top-24">{body}</div>
      </aside>

      {/* Mobile: filters + sort bar, filters in a sheet */}
      <div className="flex items-center gap-2 lg:hidden">
        <button type="button" className="btn btn-outline" onClick={() => sheet.current?.showModal()}>
          <SlidersHorizontal className="size-4" aria-hidden /> Филтри
        </button>
        <SortSelect value={s.sort} hasQuery={Boolean(s.q)} onChange={(v) => update({ sort: v })} />
      </div>
      <dialog
        ref={sheet}
        className="sheet lg:hidden"
        aria-label="Филтри"
        onClick={(e) => e.target === sheet.current && sheet.current?.close()}
      >
        <div className="flex max-h-[88dvh] flex-col">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="display text-3xl">Филтри</h2>
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Затвори" onClick={() => sheet.current?.close()}>
              <X className="size-6" aria-hidden />
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-5">{body}</div>
          <div className="safe-bottom border-t border-line px-4 pt-3">
            <button type="button" className="btn btn-primary btn-lg w-full" onClick={() => sheet.current?.close()}>
              {pending ? "Търсим…" : `Покажи ${total} ${total === 1 ? "майстор" : "майстори"}`}
            </button>
          </div>
        </div>
      </dialog>
      <span className="sr-only" aria-live="polite">
        {pending ? "Зареждаме резултатите" : ""}
      </span>
    </>
  );
}

export function SortSelect({
  value,
  hasQuery,
  onChange,
}: {
  value: SearchState["sort"];
  hasQuery: boolean;
  onChange: (v: SearchState["sort"]) => void;
}) {
  return (
    <div className="ml-auto flex items-center gap-2">
      <label htmlFor="f-sort" className="hidden text-sm font-semibold text-ink-2 sm:block">
        Подреди:
      </label>
      <select
        id="f-sort"
        className="field min-h-10 w-auto py-1.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value as SearchState["sort"])}
      >
        {SORTS.filter((o) => hasQuery || o.value !== "relevance").map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
