"use client";

import { useCallback } from "react";
import { useSearchParams } from "next/navigation";
import type { FormState } from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "@/components/submit-button";

export type PartId = "za-men" | "kakvo" | "kade" | "kontakti" | "danni";

export const PART_LABEL: Record<PartId, string> = {
  "za-men": "За мен",
  kakvo: "Какво работя",
  kade: "Къде работя",
  kontakti: "Контакти",
  danni: "Моите данни",
};

export const CRAFTSMAN_PARTS: readonly PartId[] = ["za-men", "kakvo", "kade", "kontakti", "danni"];
export const CLIENT_PARTS: readonly PartId[] = ["za-men", "kontakti", "danni"];

/**
 * Separation without lines: every row is its own light strip, what is picked turns pale yellow, 4px between strips.
 * Shared by the profile parts and the email letters.
 */
const NO_MARKER = "list-none [&::-webkit-details-marker]:hidden";

export const st = {
  /** wrapper of rows in one column */
  list: "grid gap-1",
  /** wrapper of rows in two columns from `sm` */
  grid2: "grid gap-1 sm:grid-cols-2",
  /** one tick row */
  row: "flex min-h-12 items-center gap-3 rounded-[6px] bg-surface px-3 transition-colors motion-reduce:transition-none has-[:checked]:bg-rule-soft",
  /** the same row when the limit has switched it off */
  rowOff: "cursor-not-allowed !bg-surface-2 text-ink-3",
  /** a row with a second line of explanation */
  rowTall:
    "flex items-start gap-3 rounded-[6px] bg-surface px-3 py-3 transition-colors motion-reduce:transition-none has-[:checked]:bg-rule-soft",
  /** a tick row inside a fold */
  rowIn: "flex min-h-11 items-center gap-3",
  /** small name above a group of rows */
  label: "display mb-2 text-[1.45rem]",
  /** wrapper of fold-out rows */
  folds: "grid gap-1",
  fold: "group rounded-[6px] bg-surface",
  foldSummary: `flex min-h-12 cursor-pointer items-center gap-3 px-3 ${NO_MARKER}`,
  foldBody: "pb-2 pl-11 pr-3",
  /** distance between two blocks of one part */
  blocks: "grid gap-10",
};

/** The current part from `?chast=` (missing or unknown: the first). `pick` changes the address without asking the server. */
export function useProfilePart(parts: readonly PartId[]): [PartId, (p: PartId) => void] {
  const raw = useSearchParams().get("chast");
  const current = parts.find((p) => p === raw) ?? "za-men";
  const pick = useCallback((p: PartId) => {
    const query = new URLSearchParams(window.location.search);
    if (query.get("chast") === p) return;
    query.set("chast", p);
    window.history.pushState(null, "", `?${query.toString()}`);
  }, []);
  return [current, pick];
}

/** The word menu under the title: the open part on the yellow field, a dot beside every part with unsaved changes. */
export function PartTabs({
  parts,
  current,
  dirty,
  onPick,
}: {
  parts: readonly PartId[];
  current: PartId;
  dirty: ReadonlySet<PartId>;
  onPick: (p: PartId) => void;
}) {
  return (
    <nav aria-label="Части на профила" className="mt-5">
      <ul className="flex flex-wrap gap-x-5">
        {parts.map((p) => {
          const on = p === current;
          return (
            <li key={p}>
              <button
                type="button"
                aria-current={on ? "page" : undefined}
                onClick={() => onPick(p)}
                className="group relative flex min-h-11 items-center gap-1.5"
              >
                <span
                  className={`display -mx-1.5 rounded-[4px] px-1.5 py-1 text-[1.45rem] transition-colors motion-reduce:transition-none ${
                    on ? "bg-rule text-ink" : "text-ink-3 group-hover:text-ink"
                  }`}
                >
                  {PART_LABEL[p]}
                </span>
                {dirty.has(p) && <span
                    className="absolute -right-1.5 top-1 size-2.5 rounded-full bg-brass shadow-[inset_0_0_0_1.5px_rgb(22_20_15/0.75)]"
                    role="img"
                    aria-label="има незаписани промени"
                  />}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The dark floating bar with „Отказ“ and „Запази“. Drawn inside the form, only while something is unsaved. */
export function SaveBar({ state, onCancel, text = "Имаш незаписани промени" }: { state: FormState; onCancel: () => void; text?: string }) {
  const failed = !state.ok && Boolean(state.message);
  return (
    <div
      role="region"
      aria-label="Незаписани промени"
      className="save-bar-in fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-xl flex-wrap items-center gap-1.5 rounded-[10px] bg-ink p-2 pl-4 text-white shadow-[var(--shadow-lg)] lg:bottom-5 lg:left-[calc(max((100vw-80rem)/2,0px)+18rem)] lg:right-auto lg:mx-0 lg:w-[36rem]"
    >
      {failed && (
        <div className="w-full pb-1 pr-2">
          <FormMessage state={state} />
        </div>
      )}
      <p className="flex-1 text-[0.95rem] font-semibold leading-tight">{text}</p>
      <button type="button" className="btn text-white hover:bg-white/10" onClick={onCancel}>
        Отказ
      </button>
      <SubmitButton className="btn btn-rule" pendingText="Записваме…">
        Запази
      </SubmitButton>
    </div>
  );
}
