"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { SortSelect } from "@/components/search-filters";
import { toQueryString, type SearchState } from "@/lib/search-params";

export function SortControl({ state, fixedCategory }: { state: SearchState; fixedCategory?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [, start] = useTransition();
  return (
    <SortSelect
      value={state.sort}
      hasQuery={Boolean(state.q)}
      onChange={(sort) =>
        start(() => router.replace(`${pathname}${toQueryString({ ...state, sort, page: 1 }, fixedCategory)}`, { scroll: false }))
      }
    />
  );
}
