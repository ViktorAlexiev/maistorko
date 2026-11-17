"use client";

import { OfferYellow } from "./offer-cards";
import { EmptyPane, Frame, UnreadRivet, type Refs, type Room } from "./shared";
import { Thread } from "./thread";

/** „Показалец“: the list is an index like the dashboard (names in the display face, the open one on a yellow field) beside one big field. */
export function VariantIndex({ r, scroller, box }: Refs & { r: Room }) {
  const listShown = r.screen === "list";
  return (
    <Frame>
      <div className="grid h-full grid-rows-[minmax(0,1fr)] md:grid-cols-[17.5rem_minmax(0,1fr)] md:gap-6">
        <nav aria-label="Разговори" className={`min-h-0 flex-col px-3 pt-4 md:flex md:px-0 md:pt-0 ${listShown ? "flex" : "hidden"}`}>
          <h1 className="display px-3 pb-3 text-4xl">Съобщения</h1>
          <ul className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto pb-3">
            {r.rows.map((row) => {
              const sel = row.id === r.activeId;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => r.open(row.id)}
                    aria-current={sel ? "true" : undefined}
                    className={`flex w-full items-start gap-2 rounded-[4px] px-3 py-2 text-left ${sel ? "bg-rule" : "hover:bg-ink/5"}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={`display block text-[1.6rem] ${sel || row.unread ? "text-ink" : "text-ink-3"}`}>{row.name}</span>
                      <span className="mt-1 flex items-baseline gap-2 text-sm">
                        <span className={`min-w-0 flex-1 truncate ${row.unread ? "font-semibold text-ink" : "text-ink-2"}`}>{row.preview}</span>
                        <span className={`shrink-0 text-xs ${sel ? "text-ink-2" : "text-ink-3"}`}>{row.when}</span>
                      </span>
                    </span>
                    {row.unread && <UnreadRivet />}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
        {r.active ? (
          <div className={`min-h-0 grid-rows-[minmax(0,1fr)] md:grid ${listShown ? "hidden" : "grid"}`}>
            <Thread r={r} scroller={scroller} box={box} ground="surface" className="md:overflow-hidden md:rounded-[10px]" offer={(o, bg) => <OfferYellow r={r} o={o} bg={bg} />} />
          </div>
        ) : (
          <EmptyPane />
        )}
      </div>
    </Frame>
  );
}
