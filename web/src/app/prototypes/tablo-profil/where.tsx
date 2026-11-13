"use client";

import { useId } from "react";
import { ChevronRight, Lock } from "lucide-react";
import { AREAS, CITIES, CITY_LIMIT, cityBy } from "./data";
import { proLink, st, type Draft } from "./shared";

/** „Къде работя“: the places around the main city first, the rest fold out, a plain reason at the limit. */

const areaLabel = (key: string) => AREAS.find((a) => a.key === key)!.label;

function MainCity({ d }: { d: Draft }) {
  const id = useId();
  return (
    <div className="max-w-sm">
      <label htmlFor={id} className="label">
        Основен град
      </label>
      <select id={id} className="field" value={d.v.city} onChange={(e) => d.setCity(e.target.value)}>
        {AREAS.map((a) => (
          <optgroup key={a.key} label={a.label}>
            {CITIES.filter((c) => c.around === a.key).map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export function WhereRows({ d }: { d: Draft }) {
  const { v, toggle } = d;
  const home = cityBy(v.city).around;
  const used = v.areas.length + 1;
  const full = used >= CITY_LIMIT;
  const others = AREAS.filter((a) => a.key !== home);
  const inArea = (key: string) => CITIES.filter((c) => c.around === key && c.slug !== v.city);

  const rows = (key: string, inFold: boolean) => (
    <ul className={inFold ? `grid sm:grid-cols-2 sm:gap-x-6 ${st.foldBody}` : st.grid2}>
      {inArea(key).map((c) => {
        const on = v.areas.includes(c.slug);
        const off = full && !on;
        const base = inFold ? st.rowIn : st.row;
        return (
          <li key={c.slug}>
            <label className={`${base} ${off ? st.rowOff : "cursor-pointer"}`}>
              <input
                type="checkbox"
                className="check disabled:cursor-not-allowed disabled:bg-surface-2"
                checked={on}
                disabled={off}
                onChange={(e) => toggle("areas", c.slug, e.target.checked)}
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
      <MainCity d={d} />
      <fieldset>
        <legend className="flex w-full flex-wrap items-baseline justify-between gap-x-4">
          <span className="text-xl font-extrabold">Пътувам и до</span>
          <span className="whitespace-nowrap text-sm text-ink-2">
            <span className="numerals text-xl text-ink">
              {used} от {CITY_LIMIT}
            </span>{" "}
            града с основния
          </span>
        </legend>
        {full && (
          <p role="status" className="mt-3 flex items-start gap-2.5 rounded-[6px] bg-rule-soft px-3 py-2.5 text-sm">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Избрал си {CITY_LIMIT} града, колкото дава безплатният план, затова другите отметки са изключени. Махни една, за
              да избереш друг град. {proLink}
            </span>
          </p>
        )}
        <p className={`mt-5 ${st.label}`}>{areaLabel(home)}</p>
        {rows(home, false)}
        <p className={`mt-7 ${st.label}`}>По-далече</p>
        <div className={st.folds}>
          {others.map((a) => {
            const chosen = inArea(a.key).filter((c) => v.areas.includes(c.slug));
            return (
              <details key={a.key} className={st.fold}>
                <summary className={st.foldSummary}>
                  <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-90" aria-hidden />
                  <span className="flex-1 font-bold">{a.label}</span>
                  {chosen.length > 0 && <span className="text-sm text-ink-2">{chosen.map((c) => c.name).join(", ")}</span>}
                </summary>
                {rows(a.key, true)}
              </details>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
