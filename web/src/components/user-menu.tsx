"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { signOut } from "@/app/actions/auth";

type Props = {
  name: string;
  role: "client" | "craftsman" | "admin";
  avatarUrl: string | null;
  craftsmanSlug: string | null;
};

export function UserMenu({ name, role, avatarUrl, craftsmanSlug }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const links: { href: string; label: string }[] = [{ href: "/tabla", label: "Моето табло" }];
  if (craftsmanSlug) {
    links.push(
      { href: "/tabla/kalendar", label: "Календар" },
      { href: "/tabla/tseni", label: "Цени и услуги" },
      { href: `/maistori/${craftsmanSlug}`, label: "Публичен профил" },
    );
  } else {
    links.push({ href: "/tabla/zapazeni", label: "Запазени майстори" });
  }
  links.push({ href: "/tabla/profil", label: "Настройки на профила" });
  if (role === "admin") links.push({ href: "/admin", label: "Администрация" });

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        className="btn btn-ghost btn-sm gap-2 pl-1"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Меню на профила: ${name}`}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={name} url={avatarUrl} size={30} />
        <span className="max-w-36 truncate">{name.split(" ")[0]}</span>
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-[10px] border border-line bg-surface p-1.5 shadow-[var(--shadow-lg)]"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2.5 font-semibold hover:bg-surface-2"
            >
              {l.label}
            </Link>
          ))}
          <form action={signOut} className="mt-1 border-t border-line pt-1">
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left font-semibold text-ink-2 hover:bg-surface-2"
            >
              <LogOut className="size-4" aria-hidden /> Изход
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
