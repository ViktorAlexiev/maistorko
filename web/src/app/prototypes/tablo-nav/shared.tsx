"use client";

import { useEffect, useRef, useState } from "react";
import {
  BookUser,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  Euro,
  FileText,
  Gem,
  House,
  Images,
  Link2,
  MessageSquare,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { RuleStrip } from "@/components/rule-strip";
import "./proto.css";

export type NavItem = { key: string; label: string; icon: LucideIcon; unread?: number };

const it = (key: string, label: string, icon: LucideIcon, unread?: number): NavItem => ({ key, label, icon, unread });

const pregled = it("pregled", "Преглед", House);
const kalendar = it("kalendar", "Календар", CalendarDays);
const saobshtenia = it("saobshtenia", "Съобщения", MessageSquare, 2);
const porachki = it("porachki", "Поръчки", ClipboardList);
const klienti = it("klienti", "Клиенти", BookUser);
const oferti = it("oferti", "Оферти", FileText);
const tseni = it("tseni", "Цени и услуги", Euro);
const snimki = it("snimki", "Снимки", Images);
const statistika = it("statistika", "Статистика", ChartColumn);
const link = it("link", "Моят линк", Link2);
const plan = it("plan", "План", Gem);
const profil = it("profil", "Профил", UserRound);

/** The four places in the phone bar; everything else sits behind „Още“. */
export const PRIMARY = [pregled, kalendar, saobshtenia, porachki];

/** All sections in their desktop order, in three visual groups. */
export const GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Работа", items: [pregled, kalendar, saobshtenia, porachki, klienti, oferti] },
  { label: "Пред клиентите", items: [tseni, snimki, statistika, link] },
  { label: "Настройки", items: [plan, profil] },
];

/** Groups as they appear in the „Още“ sheet: without the four that are already in the bar. */
export const MORE_GROUPS = GROUPS.map((g) => ({ ...g, items: g.items.filter((x) => !PRIMARY.includes(x)) })).filter(
  (g) => g.items.length > 0,
);

export const ALL = GROUPS.flatMap((g) => g.items);
export const isMore = (key: string) => !PRIMARY.some((p) => p.key === key);

export function Unread({ n, className = "" }: { n?: number; className?: string }) {
  if (!n) return null;
  return (
    <span
      className={`numerals grid h-5 min-w-5 place-items-center rounded-full bg-red px-1 text-[0.85rem] leading-none text-white ${className}`}
    >
      <span className="sr-only">непрочетени: </span>
      {n}
    </span>
  );
}

type Render = (active: string, pick: (key: string) => void) => React.ReactNode;

/** The dashboard frame from tabla/layout.tsx with a stand-in page, so the navigation is judged in place. */
export function Frame({ desktop, phone }: { desktop: Render; phone: Render }) {
  const [active, setActive] = useState("pregled");
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-10 lg:pb-10">
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <div className="hidden lg:block">
          <div className="sticky top-24">{desktop(active, setActive)}</div>
        </div>
        <div className="min-w-0">
          <MockPage active={active} />
        </div>
      </div>
      <div className="lg:hidden">{phone(active, setActive)}</div>
    </div>
  );
}

const BOOKINGS = [
  { when: "Утре, 09:00–11:00", kind: "оглед", who: "Мария Петрова", note: "Течащ кран в банята", ok: true },
  { when: "Събота, цял ден", kind: "работа", who: "Иван Стоянов", note: "Смяна на ел. табло", ok: true },
  { when: "Понеделник, 14:00–16:00", kind: "оглед", who: "Десислава Колева", note: "", ok: false },
];

function MockPage({ active }: { active: string }) {
  const item = ALL.find((x) => x.key === active)!;
  if (active !== "pregled") {
    return (
      <div className="max-w-2xl">
        <h1 className="display text-5xl sm:text-6xl">{item.label}</h1>
        <p className="mt-3 text-lg text-ink-2">
          Пробна страница. Тук се сменя само навигацията; съдържанието на „{item.label}“ остава каквото е сега.
        </p>
      </div>
    );
  }
  return (
    <div className="grid max-w-4xl gap-10">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Преглед</h1>
        <p className="mt-2 max-w-2xl text-lg text-ink-2">Следващите две седмици и какво предстои.</p>
      </div>
      <section aria-labelledby="proto-rule">
        <h2 id="proto-rule" className="display text-4xl">
          Свободни дни
        </h2>
        <div className="mt-3 overflow-x-auto">
          <RuleStrip strip="FFPBBFFFFPBFFB" size="md" className="min-w-[30rem]" />
        </div>
      </section>
      <section aria-labelledby="proto-bookings">
        <h2 id="proto-bookings" className="display text-4xl">
          Уговорени посещения
        </h2>
        <ul className="mt-3 grid border-t border-line">
          {BOOKINGS.map((b) => (
            <li key={b.who} className="flex items-center gap-3 border-b border-line px-1 py-3">
              {b.ok ? (
                <CalendarCheck className="size-5 shrink-0 text-free" aria-hidden />
              ) : (
                <CalendarClock className="size-5 shrink-0" aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-bold">
                  {b.when}
                  <span className="font-semibold text-ink-2"> · {b.kind}</span>
                </span>
                <span className="block truncate text-sm text-ink-3">
                  {b.who}
                  {b.note ? ` · ${b.note}` : ""}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${b.ok ? "bg-free text-white" : "bg-rule-soft"}`}
              >
                {b.ok ? "Уговорено" : "Чака отговор"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** Bottom sheet for „Още“: a native modal dialog, so Esc, focus and the backdrop come for free. */
export function MoreSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label="Още раздели"
      className="proto-sheet"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
