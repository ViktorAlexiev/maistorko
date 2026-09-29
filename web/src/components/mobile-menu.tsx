"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Menu, X } from "lucide-react";
import { signOut } from "@/app/actions/auth";

export function MobileMenu({ signedIn, nav }: { signedIn: boolean; nav: { href: string; label: string }[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    ref.current?.close();
  }, [pathname]);

  const close = () => ref.current?.close();

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm md:hidden"
        aria-label="Меню"
        onClick={() => ref.current?.showModal()}
      >
        <Menu className="size-6" aria-hidden />
      </button>
      <dialog
        ref={ref}
        className="sheet"
        aria-label="Меню"
        onClick={(e) => e.target === ref.current && close()}
      >
        <div className="safe-bottom p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="display text-3xl">Меню</span>
            <button type="button" className="btn btn-ghost btn-sm" aria-label="Затвори" onClick={close}>
              <X className="size-6" aria-hidden />
            </button>
          </div>
          <nav className="grid">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} onClick={close} className="border-b border-line py-3.5 text-lg font-bold">
                {n.label}
              </Link>
            ))}
            {signedIn ? (
              <>
                <Link href="/tabla" onClick={close} className="border-b border-line py-3.5 text-lg font-bold">
                  Моето табло
                </Link>
                <Link href="/saobshtenia" onClick={close} className="border-b border-line py-3.5 text-lg font-bold">
                  Съобщения
                </Link>
                <Link href="/tabla/profil" onClick={close} className="border-b border-line py-3.5 text-lg font-bold">
                  Настройки на профила
                </Link>
                <form action={signOut} className="pt-4">
                  <button type="submit" className="btn btn-outline w-full">
                    Изход
                  </button>
                </form>
              </>
            ) : (
              <div className="grid gap-2 pt-4">
                <Link href="/vhod" onClick={close} className="btn btn-outline btn-lg">
                  Вход
                </Link>
                <Link href="/registratsia" onClick={close} className="btn btn-outline btn-lg">
                  Регистрация на клиент
                </Link>
                <Link href="/registratsia?rolya=maistor" onClick={close} className="btn btn-primary btn-lg">
                  Стани майстор
                </Link>
              </div>
            )}
          </nav>
        </div>
      </dialog>
    </>
  );
}
