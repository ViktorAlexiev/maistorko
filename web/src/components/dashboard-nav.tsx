"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";

export function DashboardNav({
  items,
  publicHref,
}: {
  items: { href: string; label: string }[];
  publicHref: string | null;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Табло" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
      <ul className="flex gap-1 border-b border-line pb-px lg:sticky lg:top-24 lg:flex-col lg:border-b-0 lg:border-l-[1.5px] lg:border-ink lg:pb-0">
        {items.map((it) => {
          const active = it.href === "/tabla" ? pathname === "/tabla" : pathname.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`relative block whitespace-nowrap px-3 py-2.5 font-semibold transition-colors lg:py-2 ${
                  active ? "text-ink" : "text-ink-2 hover:text-ink"
                }`}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-2 -bottom-px h-[3px] rounded-t bg-red lg:inset-x-auto lg:-left-[2.5px] lg:bottom-1 lg:top-1 lg:h-auto lg:w-[3.5px] lg:rounded"
                  />
                )}
                {it.label}
              </Link>
            </li>
          );
        })}
        {publicHref && (
          <li className="lg:mt-4">
            <Link
              href={publicHref}
              className="flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-semibold text-ink-2 hover:text-ink lg:py-2"
            >
              Публичен профил <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          </li>
        )}
      </ul>
    </nav>
  );
}
