"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { Frame, GROUPS, MORE_GROUPS, MoreSheet, PRIMARY, isMore, type NavItem } from "./shared";

/** „Индекс“: no box and no icons; the sections are a printed index in the condensed face, the current one highlighted in yellow. */
export function VariantIndeks() {
  return <Frame desktop={(a, pick) => <Index active={a} pick={pick} />} phone={(a, pick) => <Bar active={a} pick={pick} />} />;
}

function Count({ it }: { it: NavItem }) {
  if (!it.unread) return null;
  return (
    <span className="numerals text-[1.35rem] leading-none text-red">
      <span className="sr-only">непрочетени: </span>
      {it.unread}
    </span>
  );
}

function Index({ active, pick }: { active: string; pick: (k: string) => void }) {
  return (
    <nav aria-label="Табло">
      {GROUPS.map((g, gi) => (
        <ul key={g.label} className={`grid ${gi > 0 ? "mt-3 border-t border-line pt-3" : ""}`}>
          {g.items.map((it) => {
            const on = it.key === active;
            return (
              <li key={it.key}>
                <button
                  type="button"
                  aria-current={on ? "page" : undefined}
                  onClick={() => pick(it.key)}
                  className="group flex min-h-10 w-full items-center gap-2 text-left"
                >
                  <span
                    className={`display -mx-2 rounded-[4px] px-2 py-1 text-[1.7rem] transition-colors ${
                      on ? "bg-rule text-ink" : "text-ink-3 group-hover:text-ink"
                    }`}
                  >
                    {it.label}
                  </span>
                  <Count it={it} />
                </button>
              </li>
            );
          })}
        </ul>
      ))}
      <a
        href="#"
        onClick={(e) => e.preventDefault()}
        className="mt-3 flex min-h-10 items-center gap-1.5 border-t border-line pt-3 text-sm font-semibold text-ink-2 hover:text-ink"
      >
        Публичен профил <ExternalLink className="size-3.5" aria-hidden />
      </a>
    </nav>
  );
}

function Bar({ active, pick }: { active: string; pick: (k: string) => void }) {
  const [open, setOpen] = useState(false);
  const word = (on: boolean) =>
    `display rounded-[4px] px-1.5 py-1 text-[1.3rem] transition-colors ${on ? "bg-rule text-ink" : "text-ink-2"}`;
  return (
    <>
      <nav
        aria-label="Табло"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_24px_-14px_rgb(22_20_15/0.3)]"
      >
        <ul className="flex items-stretch justify-between px-2">
          {PRIMARY.map((it) => {
            const on = it.key === active;
            return (
              <li key={it.key}>
                <button
                  type="button"
                  aria-current={on ? "page" : undefined}
                  onClick={() => pick(it.key)}
                  className="relative flex min-h-14 items-center"
                >
                  <span className={word(on)}>{it.label}</span>
                  {it.unread ? (
                    <span className="numerals absolute -right-1 top-1.5 text-[0.95rem] leading-none text-red">
                      <span className="sr-only">непрочетени: </span>
                      {it.unread}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen(true)}
              className="flex min-h-14 min-w-11 items-center justify-center"
            >
              <span className={word(isMore(active))}>Още</span>
            </button>
          </li>
        </ul>
      </nav>
      <MoreSheet open={open} onClose={() => setOpen(false)}>
        <div className="px-5 pb-4 pt-5">
          {MORE_GROUPS.map((g, gi) => (
            <ul key={g.label} className={`grid ${gi > 0 ? "mt-2 border-t border-line pt-2" : ""}`}>
              {g.items.map((it) => {
                const on = it.key === active;
                return (
                  <li key={it.key}>
                    <button
                      type="button"
                      aria-current={on ? "page" : undefined}
                      onClick={() => {
                        pick(it.key);
                        setOpen(false);
                      }}
                      className="flex min-h-12 w-full items-center text-left"
                    >
                      <span
                        className={`display -mx-2 rounded-[4px] px-2 py-1 text-[2rem] ${on ? "bg-rule text-ink" : "text-ink"}`}
                      >
                        {it.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ))}
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="mt-2 flex min-h-12 items-center gap-1.5 border-t border-line pt-2 font-semibold text-ink-2"
          >
            Публичен профил <ExternalLink className="size-4" aria-hidden />
          </a>
        </div>
      </MoreSheet>
    </>
  );
}
