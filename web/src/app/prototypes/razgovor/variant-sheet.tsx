"use client";

import { useState } from "react";
import { OfferReceipt } from "./offer-cards";
import { EmptyPane, Frame, RowContent, type Refs, type Room, type RowsProps } from "./shared";
import { Thread } from "./thread";

/** „Един лист“: one Card Surface sheet holds both panes. The list is one tone back; the open row is Card Surface and runs flush into the conversation. On a phone the list screen looks like „Приложение“: a bar with the search, strips on the pane. */
export function VariantSheet({ r, scroller, box }: Refs & { r: Room }) {
  const [q, setQ] = useState("");
  const rows = r.rows.filter((row) => row.name.toLowerCase().includes(q.trim().toLowerCase()));
  const listShown = r.screen === "list";
  return (
    <Frame>
      <div className="grid h-full grid-rows-[minmax(0,1fr)] overflow-hidden bg-surface sm:rounded-[10px] md:grid-cols-[22rem_minmax(0,1fr)]">
        <aside aria-label="Разговори" className={`min-h-0 flex-col bg-surface-2 md:flex ${listShown ? "flex" : "hidden"}`}>
          <div className="flex items-center gap-3 bg-surface px-3 py-2 md:hidden">
            <h1 className="display shrink-0 text-3xl">Съобщения</h1>
            <label htmlFor="sheet-search" className="sr-only">
              Търси разговор по име
            </label>
            <input id="sheet-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Търси по име" className="field min-h-11 min-w-0 flex-1 py-1.5" />
          </div>
          <h1 className="display hidden px-4 pb-3 pt-4 text-4xl md:block">Съобщения</h1>
          <SheetRows rows={rows} activeId={r.activeId} onOpen={r.open} />
          {rows.length === 0 && <p className="p-4 text-center text-ink-2">Няма разговор с това име.</p>}
        </aside>
        {r.active ? (
          <div className={`min-h-0 grid-rows-[minmax(0,1fr)] md:grid ${listShown ? "hidden" : "grid"}`}>
            <Thread r={r} scroller={scroller} box={box} ground="surface" offer={(o, bg) => <OfferReceipt r={r} o={o} bg={bg} />} />
          </div>
        ) : (
          <EmptyPane className="bg-surface" />
        )}
      </div>
    </Frame>
  );
}

/**
 * The one row list for the messages page and „Преглед“. From md up: „Един лист“ (rows straight on the list pane, the open one Card Surface and flush into the conversation).
 * Below md: the „Приложение“ look (Card Surface strips, the open one Pale Rule Yellow). On „Преглед“ the rows lie on a Panel Surface field.
 */
export function SheetRows({ rows, activeId, onOpen, home = false }: RowsProps) {
  return (
    <ul
      className={
        home
          ? "grid content-start gap-1 rounded-[10px] bg-surface-2 p-2"
          : "grid min-h-0 flex-1 content-start gap-1 overflow-y-auto p-2 md:p-0 md:pb-3 md:pl-2"
      }
    >
      {rows.map((row) => {
        const sel = row.id === activeId;
        return (
          <li key={row.id} className={home ? undefined : sel ? "md:pr-0" : "md:pr-2"}>
            <button
              type="button"
              onClick={() => onOpen(row.id)}
              aria-current={sel ? "true" : undefined}
              className={`flex w-full gap-3 rounded-[6px] px-3 py-3 text-left ${
                sel ? "bg-rule-soft md:rounded-r-none md:bg-surface" : "bg-surface hover:bg-paper md:bg-transparent"
              }`}
            >
              <RowContent row={row} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
