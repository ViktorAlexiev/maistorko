"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { UnreadBadge } from "@/components/unread-badge";
import { isActive, type NavItem } from "@/lib/dashboard-nav";

/** The dashboard sections: a printed index on desktop; below lg a row of words that scrolls sideways (or nothing). */
export function DashboardNav({
  groups,
  publicHref,
  unread,
  phoneRow,
}: {
  groups: NavItem[][];
  publicHref: string | null;
  unread: { userId: string; initial: number } | null;
  phoneRow: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Табло"
      className={`${
        phoneRow ? "-mx-4 overflow-x-auto px-4" : "hidden"
      } lg:-mx-2 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-x-visible lg:overflow-y-auto lg:px-2 lg:sticky lg:top-24`}
    >
      <div className="flex items-center gap-1 lg:block">
        {groups.map((group, gi) => (
          <ul key={gi} className={`flex gap-1 lg:grid lg:gap-0 ${gi > 0 ? "lg:mt-[1.125rem]" : ""}`}>
            {group.map((it) => {
              const active = isActive(it.href, pathname);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    className="group flex min-h-11 items-center gap-2 whitespace-nowrap lg:min-h-10"
                  >
                    <span
                      className={`display rounded-[4px] px-1.5 py-1 text-[1.3rem] lg:-mx-2 lg:px-2 transition-colors motion-reduce:transition-none lg:text-[1.7rem] ${
                        active ? "bg-rule text-ink" : "text-ink-2 group-hover:text-ink lg:text-ink-3"
                      }`}
                    >
                      {it.label}
                    </span>
                    {unread && it.href === "/saobshtenia" && (
                      <UnreadBadge
                        userId={unread.userId}
                        initial={unread.initial}
                        className="numerals grid h-6 min-w-6 place-items-center rounded-[4px] bg-ink px-1.5 text-[1.05rem] leading-none text-rule"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        ))}
        {publicHref && (
          <Link
            href={publicHref}
            className="flex min-h-11 items-center gap-1.5 whitespace-nowrap px-1.5 text-sm font-semibold text-ink-2 hover:text-ink lg:mt-[1.125rem] lg:min-h-10 lg:px-0"
          >
            Публичен профил <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
    </nav>
  );
}
