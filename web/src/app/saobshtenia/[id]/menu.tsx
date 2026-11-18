"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type MenuItem = {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  /** a choice that runs something */
  onSelect?: () => void;
  /** a choice that goes to another page */
  href?: string;
};

const ITEM = "flex min-h-11 w-full items-start gap-3 rounded-[6px] px-3 py-2 text-left hover:bg-paper";

/** A button with a small list that closes on Esc, on a click outside and after a choice. */
export function Menu({
  label,
  trigger,
  triggerClass,
  items,
  placement = "down-right",
  width = "w-56",
}: {
  label: string;
  trigger: (open: boolean) => React.ReactNode;
  triggerClass: string;
  items: MenuItem[];
  placement?: "down-right" | "up-left";
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);
  return (
    <div ref={wrap} className="relative shrink-0">
      <button type="button" className={triggerClass} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {trigger(open)}
      </button>
      {open && (
        <ul role="menu" className={`absolute z-40 grid gap-1 rounded-[10px] bg-surface p-1.5 text-ink shadow-[var(--shadow-lg)] ${width} ${placement === "down-right" ? "right-0 top-full mt-1" : "bottom-full left-0 mb-2"}`}>
          {items.map((it) => {
            const body = (
              <>
                {it.icon}
                <span>
                  <span className="block font-bold">{it.label}</span>
                  {it.hint && <span className="block text-sm text-ink-2">{it.hint}</span>}
                </span>
              </>
            );
            return (
              <li key={it.label} role="none">
                {it.href ? (
                  <Link href={it.href} role="menuitem" className={ITEM} onClick={() => setOpen(false)}>
                    {body}
                  </Link>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className={ITEM}
                    onClick={() => {
                      setOpen(false);
                      it.onSelect?.();
                    }}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
