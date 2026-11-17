"use client";

import { OfferReceipt } from "./offer-cards";
import { EmptyPane, Frame, RowContent, type Refs, type Room, type RowsProps } from "./shared";
import { Thread } from "./thread";

/** „Един лист“: one Card Surface sheet holds both panes. The list is one tone back; the open row is Card Surface and runs flush into the conversation. */
export function VariantSheet({ r, scroller, box }: Refs & { r: Room }) {
  const listShown = r.screen === "list";
  return (
    <Frame>
      <div className="grid h-full grid-rows-[minmax(0,1fr)] overflow-hidden bg-surface sm:rounded-[10px] md:grid-cols-[22rem_minmax(0,1fr)]">
        <aside aria-label="Разговори" className={`min-h-0 flex-col bg-surface-2 md:flex ${listShown ? "flex" : "hidden"}`}>
          <h1 className="display px-4 pb-3 pt-4 text-4xl">Съобщения</h1>
          <SheetRows rows={r.rows} activeId={r.activeId} onOpen={r.open} />
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

/** The rows of „Един лист“: in the list pane of the sheet the open row is Card Surface and runs flush into the conversation; on „Преглед“ they lie on a Panel Surface field. */
export function SheetRows({ rows, activeId, onOpen, home = false }: RowsProps) {
  return (
    <ul className={home ? "grid content-start gap-1 rounded-[10px] bg-surface-2 p-2" : "grid min-h-0 flex-1 content-start gap-1 overflow-y-auto pb-3 pl-2"}>
      {rows.map((row) => {
        const sel = row.id === activeId;
        return (
          <li key={row.id} className={home ? undefined : sel ? "pr-2 md:pr-0" : "pr-2"}>
            <button
              type="button"
              onClick={() => onOpen(row.id)}
              aria-current={sel ? "true" : undefined}
              className={`flex w-full gap-3 rounded-[6px] px-3 py-3 text-left ${sel ? "bg-surface md:rounded-r-none" : "hover:bg-paper"}`}
            >
              <RowContent row={row} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
