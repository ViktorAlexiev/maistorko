"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { RuleLegend } from "@/components/rule-strip";
import { presetData } from "./red-data";
import { RedRowView } from "./row";

/**
 * The catalogue results page (/maistori?q=...) with a static search bar and no filters, so the rows have their real
 * width. The rows are the approved variant „Под цената“.
 */
export function RedProto({ preset }: { preset: 1 | 2 }) {
  const d = presetData(preset);
  return (
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-y-8">
            <div className="min-w-0 lg:self-end">
              <h1 className="display text-5xl sm:text-6xl">Майстори</h1>
            </div>
            <div
              aria-hidden
              className="rounded-[12px] bg-rule p-2 shadow-[inset_0_0_0_1.5px_var(--ink),var(--shadow-md)] lg:col-start-2 lg:row-start-1 lg:self-start"
            >
              <div className="flex gap-2">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-3 sm:left-3.5" aria-hidden />
                  <input
                    type="search"
                    readOnly
                    tabIndex={-1}
                    value={d.query}
                    className="field h-13 border-ink/50 pl-10 pr-3 sm:pl-11 sm:text-lg [&::-webkit-search-cancel-button]:hidden"
                  />
                </div>
                <span className="btn btn-primary h-13 shrink-0 px-3.5 text-base sm:px-5">
                  <Search className="size-5 sm:hidden" aria-hidden />
                  <span className="sr-only sm:not-sr-only">Търси</span>
                </span>
              </div>
            </div>

            <section aria-labelledby="results-heading" className="min-w-0 lg:col-start-2">
              <p className="mb-3 text-sm text-ink-3">
                Пробно търсене:{" "}
                <Link href="?q=1" className={`link ${preset === 1 ? "font-bold" : ""}`}>
                  смяна на контакт
                </Link>
                {" · "}
                <Link href="?q=2" className={`link ${preset === 2 ? "font-bold" : ""}`}>
                  теч
                </Link>
              </p>
              <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-ink pb-3">
                <h2 id="results-heading" className="text-lg font-extrabold">
                  <span className="numerals mr-1.5 text-3xl">{d.count}</span>
                  {d.count === 1 ? "майстор" : "майстори"}
                  <span className="font-semibold text-ink-2"> · Всички налични</span>
                </h2>
              </div>
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Активни филтри">
                <li>
                  <span className="inline-flex min-h-8 items-center gap-1 rounded-full bg-ink px-3 text-sm font-semibold text-white">
                    „{d.query}“ <X className="size-3.5" aria-hidden />
                  </span>
                </li>
              </ul>
              <RuleLegend className="mt-4" />
              <ol className="stagger mt-3 grid gap-3">
                {d.rows.map((c) => (
                  <li key={c.id}>
                    <RedRowView c={c} />
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
  );
}
