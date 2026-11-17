"use client";

import { useState } from "react";
import { OfferRow } from "./offer-cards";
import { EmptyPane, Frame, RowContent, type Refs, type Room } from "./shared";
import { Thread, ThreadHeader } from "./thread";

/** „Приложение“: edge to edge. One top bar runs across both panes (title and search on the left, the conversation header on the right). */
export function VariantApp({ r, scroller, box }: Refs & { r: Room }) {
  const [q, setQ] = useState("");
  const listShown = r.screen === "list";
  const rows = r.rows.filter((row) => row.name.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <Frame full>
      <div className="grid h-full grid-cols-1 grid-rows-[auto_minmax(0,1fr)] md:grid-cols-[20rem_minmax(0,1fr)]">
        <div className={`items-center gap-3 bg-surface px-3 py-2 md:col-start-1 md:row-start-1 md:flex md:px-4 ${listShown ? "flex" : "hidden"}`}>
          <h1 className="display shrink-0 text-3xl">Съобщения</h1>
          <label htmlFor="app-search" className="sr-only">
            Търси разговор по име
          </label>
          <input id="app-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Търси по име" className="field min-h-11 min-w-0 flex-1 py-1.5" />
        </div>
        {r.active ? (
          <div className={`md:col-start-2 md:row-start-1 md:block ${listShown ? "hidden" : "block"}`}>
            <ThreadHeader r={r} />
          </div>
        ) : (
          <div className="hidden bg-surface md:col-start-2 md:row-start-1 md:block" />
        )}
        <aside aria-label="Разговори" className={`min-h-0 flex-col bg-surface-2 md:col-start-1 md:row-start-2 md:flex ${listShown ? "flex" : "hidden"}`}>
          <ul className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto p-2">
            {rows.map((row) => {
              const sel = row.id === r.activeId;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => r.open(row.id)}
                    aria-current={sel ? "true" : undefined}
                    className={`flex w-full gap-3 rounded-[6px] px-3 py-3 text-left ${sel ? "bg-rule-soft" : "bg-surface hover:bg-paper"}`}
                  >
                    <RowContent row={row} />
                  </button>
                </li>
              );
            })}
            {rows.length === 0 && <li className="p-4 text-center text-ink-2">Няма разговор с това име.</li>}
          </ul>
        </aside>
        {r.active ? (
          <div className={`min-h-0 grid-rows-[minmax(0,1fr)] md:col-start-2 md:row-start-2 md:grid ${listShown ? "hidden" : "grid"}`}>
            <Thread r={r} scroller={scroller} box={box} bare offer={(o, bg) => <OfferRow r={r} o={o} bg={bg} />} />
          </div>
        ) : (
          <EmptyPane className="bg-paper md:col-start-2 md:row-start-2" />
        )}
      </div>
    </Frame>
  );
}
