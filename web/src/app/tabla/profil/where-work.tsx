"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";
import { FieldError } from "@/components/submit-button";
import type { City } from "@/lib/data";
import { HUBS, HUB_LABEL, type Hub } from "@/lib/hubs";
import { st } from "./profile-parts";

/**
 * „Къде работя“: the main city, then the places around it first, the other groups fold out, a plain reason at the limit.
 * The select (`city`) and the ticks (`areas`) are uncontrolled, because React resets the form after every save, failed or
 * not; their state is mirrored here for the groups, the counter and the limit. After a failed save the form remounts this
 * block with the sent values.
 */
export function WhereWork({
  cities,
  initialCity,
  initialAreas,
  maxAreas,
  cityError,
}: {
  cities: City[];
  initialCity: string;
  initialAreas: string[];
  /** cities besides the main one; null = unlimited */
  maxAreas: number | null;
  cityError?: string;
}) {
  const cityId = useId();
  const [city, setCity] = useState(initialCity);
  const [areas, setAreas] = useState<ReadonlySet<string>>(() => new Set(initialAreas.filter((s) => s !== initialCity)));

  const regions = Array.from(new Set(cities.map((c) => c.region)));
  const home: Hub | null = cities.find((c) => c.slug === city)?.hub ?? null;
  const others = HUBS.filter((h) => h !== home);
  const inHub = (hub: Hub) => cities.filter((c) => c.hub === hub && c.slug !== city);

  const limited = maxAreas != null;
  const used = areas.size + (home ? 1 : 0);
  const total = limited ? maxAreas + 1 : 0;
  const full = limited && areas.size >= maxAreas;

  const pickCity = (slug: string) => {
    setCity(slug);
    // a city cannot be the main one and a ticked one at once
    setAreas((s) => {
      if (!s.has(slug)) return s;
      const n = new Set(s);
      n.delete(slug);
      return n;
    });
  };

  const toggle = (slug: string, on: boolean) =>
    setAreas((s) => {
      const n = new Set(s);
      if (on) n.add(slug);
      else n.delete(slug);
      return n;
    });

  const rows = (hub: Hub, inFold: boolean) => (
    <ul className={inFold ? `grid sm:grid-cols-2 sm:gap-x-6 ${st.foldBody}` : st.grid2}>
      {inHub(hub).map((c) => {
        const on = areas.has(c.slug);
        const off = full && !on;
        return (
          <li key={c.slug}>
            <label className={`${inFold ? st.rowIn : st.row} ${off ? st.rowOff : "cursor-pointer"}`}>
              <input
                type="checkbox"
                name="areas"
                value={c.slug}
                className="check disabled:cursor-not-allowed disabled:bg-surface-2"
                defaultChecked={on}
                disabled={off}
                onChange={(e) => toggle(c.slug, e.target.checked)}
              />
              {c.name}
            </label>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="grid max-w-2xl gap-6">
      <div className="max-w-sm">
        <label htmlFor={cityId} className="label">
          Основен град
        </label>
        <select
          id={cityId}
          name="city"
          className="field"
          defaultValue={initialCity}
          onChange={(e) => pickCity(e.target.value)}
          aria-invalid={Boolean(cityError)}
          aria-describedby={cityError ? "city-err" : undefined}
        >
          <option value="">Изберете град</option>
          {regions.map((r) => (
            <optgroup key={r} label={`Област ${r}`}>
              {cities
                .filter((c) => c.region === r)
                .map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
        <FieldError id="city-err" message={cityError} />
      </div>
      <fieldset>
        <legend className="flex w-full flex-wrap items-baseline justify-between gap-x-4">
          <span className="text-xl font-extrabold">Пътувам и до</span>
          {limited && (
            <span className="whitespace-nowrap text-sm text-ink-2">
              <span className="numerals text-xl text-ink">
                {used} от {total}
              </span>{" "}
              града с основния
            </span>
          )}
        </legend>
        {limited && full && (
          <p role="status" className="mt-3 flex items-start gap-2.5 rounded-[6px] bg-rule-soft px-3 py-2.5 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Избрал си {total} града, колкото дава безплатният план, затова другите отметки са изключени. Махни една, за да
              избереш друг град.{" "}
              <Link href="/tabla/plan" className="link font-bold">
                Виж Pro
              </Link>
            </span>
          </p>
        )}
        {home && (
          <>
            <p className={`mt-5 ${st.label}`}>{HUB_LABEL[home]}</p>
            {rows(home, false)}
          </>
        )}
        <p className={`${home ? "mt-7" : "mt-5"} ${st.label}`}>По-далече</p>
        <div className={st.folds}>
          {others.map((hub) => {
            const chosen = inHub(hub).filter((c) => areas.has(c.slug));
            return (
              <details key={hub} className={st.fold}>
                <summary className={st.foldSummary}>
                  <ChevronRight
                    className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none"
                    aria-hidden
                  />
                  <span className="flex-1 font-bold">{HUB_LABEL[hub]}</span>
                  {chosen.length > 0 && <span className="text-sm text-ink-2">{chosen.map((c) => c.name).join(", ")}</span>}
                </summary>
                {rows(hub, true)}
              </details>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
