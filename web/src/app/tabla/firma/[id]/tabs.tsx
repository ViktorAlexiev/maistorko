"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function EmployeeTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: `/tabla/firma/${id}/kalendar`, label: "Календар" },
    { href: `/tabla/firma/${id}/porachki`, label: "Поръчки" },
  ];
  return (
    <nav aria-label="Раздели" className="flex gap-1 border-b border-ink">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`relative px-4 py-3 font-bold transition-colors ${active ? "text-ink" : "text-ink-3 hover:text-ink"}`}
          >
            {t.label}
            {active && <span aria-hidden className="absolute inset-x-2 -bottom-px h-[3px] rounded-t bg-red" />}
          </Link>
        );
      })}
    </nav>
  );
}
