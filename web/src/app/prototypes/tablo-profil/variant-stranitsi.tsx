"use client";

import { useState } from "react";
import { PARTS, type PartKey } from "./data";
import { AboutFields, ContactFields, DataFields, Frame, WorkFields, useDraft } from "./shared";
import { WhereRows } from "./where";

const LEAD: Record<PartKey, string> = {
  "za-men": "Това виждат клиентите най-горе на страницата ти.",
  kakvo: "",
  kade: "Клиентите те намират по тези градове.",
  kontakti: "Как да стигат до теб клиентите и какво да ти пращаме.",
  danni: "",
};

/** „Страници“ with „Плочки“: a word menu under the title, one part on the screen at a time, rows as light strips without lines. */
export function VariantStranitsi({ part: first }: { part?: PartKey }) {
  const d = useDraft();
  const [part, setPart] = useState<PartKey>(first ?? "za-men");
  return (
    <Frame>
      <div className={d.dirty ? "pb-24" : ""}>
        <h1 className="display text-5xl sm:text-6xl">Профил</h1>
        <nav aria-label="Части на профила" className="mt-5">
          <ul className="flex flex-wrap gap-x-5">
            {PARTS.map((p) => {
              const on = p.key === part;
              return (
                <li key={p.key}>
                  <button
                    type="button"
                    aria-current={on ? "page" : undefined}
                    onClick={() => setPart(p.key)}
                    className="group flex min-h-11 items-center gap-1.5"
                  >
                    <span
                      className={`display -mx-1.5 rounded-[4px] px-1.5 py-1 text-[1.45rem] transition-colors ${
                        on ? "bg-rule text-ink" : "text-ink-3 group-hover:text-ink"
                      }`}
                    >
                      {p.label}
                    </span>
                    {d.dirtyParts.includes(p.key) && (
                      <span className="ml-1 size-1.5 rounded-full bg-ink" role="img" aria-label="има незаписани промени" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section className="mt-7" aria-label={PARTS.find((p) => p.key === part)!.label}>
          {LEAD[part] && <p className="mb-6 max-w-2xl text-lg text-ink-2">{LEAD[part]}</p>}
          {part === "za-men" && <AboutFields d={d} />}
          {part === "kakvo" && <WorkFields d={d} />}
          {part === "kade" && <WhereRows d={d} />}
          {part === "kontakti" && <ContactFields d={d} />}
          {part === "danni" && <DataFields />}
        </section>
      </div>

      {d.dirty && (
        <div
          role="region"
          aria-label="Незаписани промени"
          className="proto-bar-in fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-xl items-center gap-1.5 rounded-[10px] bg-ink p-2 pl-4 text-white shadow-[var(--shadow-lg)] lg:bottom-5 lg:left-[calc(max((100vw-80rem)/2,0px)+18rem)] lg:right-auto lg:mx-0 lg:w-[36rem]"
        >
          <p className="flex-1 text-[0.95rem] font-semibold leading-tight">Имаш незаписани промени</p>
          <button type="button" className="btn text-white hover:bg-white/10" onClick={d.reset}>
            Отказ
          </button>
          <button type="button" className="btn btn-rule" onClick={d.save}>
            Запази
          </button>
        </div>
      )}
    </Frame>
  );
}
