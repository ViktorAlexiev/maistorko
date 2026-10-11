"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { toQueryString, type SearchState } from "@/lib/search-params";

/** The free-text search, pulled out of the filter column so it sits next to the page title. */
export function QuerySearch({
  state,
  fixedCategory,
  className = "",
}: {
  state: SearchState;
  /** Category page slug, kept out of the query string like the filters do */
  fixedCategory?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(state.q);
  const [prevQ, setPrevQ] = useState(state.q);
  if (prevQ !== state.q) {
    setPrevQ(state.q);
    setQ(state.q);
  }

  function go(next: string) {
    startTransition(() => {
      router.replace(`${pathname}${toQueryString({ ...state, q: next.trim(), page: 1 }, fixedCategory)}`, { scroll: false });
    });
  }

  return (
    <form
      role="search"
      aria-label="Търсене на майстор"
      onSubmit={(e) => {
        e.preventDefault();
        go(q);
      }}
      className={`rounded-[12px] bg-rule p-2 shadow-[inset_0_0_0_1.5px_var(--ink),var(--shadow-md)] ${className}`}
    >
      <label htmlFor="q-search" className="sr-only">
        Какво търсите?
      </label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-5 sm:left-3.5 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            id="q-search"
            type="search"
            className={`field h-13 border-ink/50 pl-10 sm:pl-11 sm:text-lg [&::-webkit-search-cancel-button]:hidden ${q ? "pr-10" : "pr-3"}`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            enterKeyHint="search"
            autoComplete="off"
          />
          {/* A placeholder that can be shorter on phones, which a real placeholder can't */}
          {!q && (
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-10 right-3 sm:left-11 flex items-center truncate text-ink-3 sm:text-lg">
              <span className="truncate sm:hidden">Какъв майстор ти трябва?</span>
              <span className="hidden truncate sm:inline">За какво ти трябва майстор днес?</span>
            </span>
          )}
          {q && (
            <button
              type="button"
              aria-label="Изчисти търсенето"
              className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-ink/5 hover:text-ink"
              onClick={() => {
                setQ("");
                if (state.q) go("");
              }}
            >
              <X className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <button type="submit" className="btn btn-primary h-13 shrink-0 px-3.5 text-base sm:px-5" disabled={pending}>
          <Search className="size-5 sm:hidden" aria-hidden />
          <span className="sr-only sm:not-sr-only">Търси</span>
        </button>
      </div>
    </form>
  );
}
