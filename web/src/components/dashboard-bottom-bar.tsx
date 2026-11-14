"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { UnreadBadge } from "@/components/unread-badge";
import { isActive, type NavItem } from "@/lib/dashboard-nav";

/** The phone bottom bar of the dashboard (words only, current one in yellow) and the „Още“ sheet with the other sections. Not on desktop and not in an open conversation. */
export function DashboardBottomBar({
  bar,
  more,
  publicHref,
  unread,
}: {
  bar: NavItem[];
  more: NavItem[][];
  publicHref: string | null;
  unread: { userId: string; initial: number } | null;
}) {
  const pathname = usePathname();
  // The sheet is open only on the page where it was opened, so a route change closes it.
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  if (pathname.startsWith("/saobshtenia/")) return null;

  const word = (on: boolean) =>
    `display rounded-[4px] px-1.5 py-1 text-[1.3rem] transition-colors motion-reduce:transition-none ${
      on ? "bg-rule text-ink" : "text-ink-2"
    }`;
  const press =
    "touch-manipulation select-none transition-transform duration-150 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";
  const moreOn = more.some((g) => g.some((it) => isActive(it.href, pathname)));

  return (
    <>
      <nav
        aria-label="Табло"
        className="bottom-nav fixed inset-x-0 bottom-0 z-40 bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_24px_-14px_rgb(22_20_15/0.3)] lg:hidden"
      >
        <ul className="flex items-stretch justify-between px-2">
          {bar.map((it) => {
            const active = isActive(it.href, pathname);
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-14 items-center ${press}`}
                >
                  <span className={word(active)}>{it.label}</span>
                  {unread && it.href === "/saobshtenia" && (
                    <UnreadBadge
                      userId={unread.userId}
                      initial={unread.initial}
                      className="numerals absolute -right-2 top-0.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-[4px] bg-ink px-1 text-[0.85rem] leading-none text-rule ring-2 ring-surface"
                    />
                  )}
                </Link>
              </li>
            );
          })}
          {more.length > 0 && (
            <li>
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpenPath(pathname)}
                className={`flex min-h-14 min-w-11 items-center justify-center ${press}`}
              >
                <span className={word(moreOn)}>Още</span>
              </button>
            </li>
          )}
        </ul>
      </nav>
      {more.length > 0 && (
        <dialog
          ref={ref}
          aria-label="Още раздели"
          className="sheet"
          onClose={() => setOpenPath(null)}
          onClick={(e) => {
            if (e.target === ref.current) setOpenPath(null);
          }}
        >
          <div className="safe-bottom relative px-5 pt-5">
            <button
              type="button"
              aria-label="Затвори"
              onClick={() => setOpenPath(null)}
              className="btn btn-ghost absolute right-2 top-2 w-11 px-0"
            >
              <X className="size-6" aria-hidden />
            </button>
            {more.map((group, gi) => (
              <ul key={gi} className={`grid ${gi > 0 ? "mt-[1.125rem]" : ""}`}>
                {group.map((it) => {
                  const active = isActive(it.href, pathname);
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setOpenPath(null)}
                        className="flex min-h-12 w-full items-center"
                      >
                        <span className={`display -mx-2 rounded-[4px] px-2 py-1 text-[2rem] ${active ? "bg-rule text-ink" : "text-ink"}`}>
                          {it.label}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ))}
            {publicHref && (
              <Link href={publicHref} onClick={() => setOpenPath(null)} className="mt-[1.125rem] flex min-h-12 items-center gap-1.5 font-semibold text-ink-2">
                Публичен профил <ExternalLink className="size-4" aria-hidden />
              </Link>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}
