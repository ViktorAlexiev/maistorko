"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { CalendarDays, Search } from "lucide-react";
import { addDaysISO, isoWeekday, parseISO, relativeDay, todayISO, WEEKDAYS_SHORT } from "@/lib/format";

type Opt = { slug: string; name: string };
type CityOpt = Opt & { region: string; is_major: boolean };

const DAYS = 14;

export function SearchBand({
  categories,
  cities,
  initial,
}: {
  categories: Opt[];
  cities: CityOpt[];
  initial?: { q?: string; city?: string; date?: string };
}) {
  const router = useRouter();
  const id = useId();
  const [today] = useState(todayISO);
  const [what, setWhat] = useState(initial?.q ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDaysISO(today, i)), [today]);
  const idx = date ? days.indexOf(date) : -1;

  const majors = cities.filter((c) => c.is_major);
  const regions = Array.from(new Set(cities.filter((c) => !c.is_major).map((c) => c.region)));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    const text = what.trim();
    const cat = categories.find((c) => c.name.toLowerCase() === text.toLowerCase());
    if (cat) p.set("kategoria", cat.slug);
    else if (text) p.set("q", text);
    if (city) p.set("grad", city);
    if (date) p.set("data", date);
    router.push(`/maistori${p.size ? `?${p}` : ""}`);
  }

  return (
    <form
      onSubmit={submit}
      role="search"
      aria-label="Търсене на майстор"
      className="relative overflow-hidden rounded-[12px] bg-rule shadow-[inset_0_0_0_1.5px_var(--ink),var(--shadow-md)]"
    >
      <div className="grid gap-3 p-4 pb-3 sm:p-5 sm:pb-3 md:grid-cols-[1.5fr_1fr_auto] md:items-end">
        <div>
          <label htmlFor={`${id}-what`} className="label">
            Какво трябва да се направи?
          </label>
          <input
            id={`${id}-what`}
            className="field border-ink/50"
            list={`${id}-cats`}
            placeholder="напр. смяна на смесител, климатик, боядисване"
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
          />
          <datalist id={`${id}-cats`}>
            {categories.map((c) => (
              <option key={c.slug} value={c.name} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor={`${id}-city`} className="label">
            Град
          </label>
          <select id={`${id}-city`} className="field border-ink/50" value={city} onChange={(e) => setCity(e.target.value)}>
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
        </div>
        <button type="submit" className="btn btn-primary btn-lg w-full md:w-auto">
          <Search className="size-5" aria-hidden /> Търси
        </button>
      </div>

      {/* The rule: tap a day to choose when you need the work done */}
      <fieldset className="border-t-[1.5px] border-ink/80">
        <legend className="sr-only">Кога ви трябва?</legend>
        <div className="flex items-center justify-between gap-3 px-4 pt-2.5 sm:px-5">
          <p className="text-sm font-bold">
            <CalendarDays className="mr-1 inline size-4 -translate-y-px" aria-hidden />
            Кога?{" "}
            <span className="font-semibold">
              {date ? `${relativeDay(date, today)[0].toUpperCase()}${relativeDay(date, today).slice(1)}` : "Без значение"}
            </span>
          </p>
          <div className="flex items-center gap-2">
            {date && (
              <button type="button" className="text-sm font-bold underline underline-offset-2" onClick={() => setDate("")}>
                Изчисти
              </button>
            )}
            <label className="relative inline-flex cursor-pointer items-center text-sm font-bold underline underline-offset-2">
              Друга дата
              <input
                type="date"
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Изберете друга дата"
              />
            </label>
          </div>
        </div>
        <div className="relative mt-1.5 overflow-x-auto">
          <div className="relative flex min-w-[36rem]">
            {days.map((d, i) => {
              const dt = parseISO(d);
              const w = isoWeekday(d);
              const active = d === date;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={active}
                  aria-label={relativeDay(d, today)}
                  onClick={() => setDate(active ? "" : d)}
                  className="group relative flex h-16 flex-1 flex-col items-center justify-end pb-2 transition-colors hover:bg-ink/[0.06]"
                >
                  <span aria-hidden className="absolute left-0 top-0 h-4 w-px bg-ink" />
                  <span aria-hidden className="absolute left-1/4 top-0 h-1.5 w-px bg-ink/70" />
                  <span aria-hidden className="absolute left-1/2 top-0 h-2.5 w-px bg-ink/80" />
                  <span aria-hidden className="absolute left-3/4 top-0 h-1.5 w-px bg-ink/70" />
                  {w === 1 && i > 0 && (
                    <span aria-hidden className="absolute -left-[5px] top-[18px] size-2.5 rounded-full border border-ink/70 bg-brass" />
                  )}
                  <span
                    className={`numerals text-2xl leading-none ${d === today ? "text-red" : ""} ${active ? "underline decoration-2 underline-offset-4" : ""}`}
                  >
                    {dt.getUTCDate()}
                  </span>
                  <span className={`text-[0.7rem] font-bold uppercase leading-none ${w >= 6 ? "text-ink/60" : "text-ink/85"}`}>
                    {i === 0 ? "днес" : WEEKDAYS_SHORT[w - 1]}
                  </span>
                </button>
              );
            })}
            <span
              aria-hidden
              className="rule-marker pointer-events-none absolute bottom-0 top-0 w-[calc(100%/14)]"
              style={{ left: `calc(${Math.max(idx, 0)} * 100% / 14)`, opacity: idx >= 0 ? 1 : 0 }}
            >
              <span className="absolute inset-x-1 bottom-0 h-1 rounded-t-sm bg-red" />
              <span className="absolute left-1/2 top-0 -translate-x-1/2 border-x-[7px] border-t-[9px] border-x-transparent border-t-red" />
            </span>
          </div>
        </div>
      </fieldset>
    </form>
  );
}
