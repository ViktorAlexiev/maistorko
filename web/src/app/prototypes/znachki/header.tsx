"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CalendarClock, CalendarDays, Check, ChevronDown, Menu, MessageCircle, Star } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Logo } from "@/components/logo";

const NAV = ["Майстори", "Категории", "Как работи"];

/**
 * „Като в профила“: the unsaved-changes mark of the profile sections (profile-parts.tsx), but red: 10px, the same inset ink ring,
 * out of the layout at the top-right corner so nothing moves when it appears. On desktop it sits on the word, on phones (word hidden) on the icon.
 */
const PROFILE_DOT = "absolute size-2.5 rounded-full bg-red shadow-[inset_0_0_0_1.5px_rgb(22_20_15/0.75)]";
const PROFILE_DOT_WORD = `${PROFILE_DOT} -right-2 -top-1.5`;
const PROFILE_DOT_ICON = `${PROFILE_DOT} -right-1.5 -top-1.5 sm:hidden`;

/** A red count in the look of the Tab: condensed numerals, white on red, 4px corners, about 20px high; „99+“ above 99. */
function Count({ n }: { n: number }) {
  return (
    <span className="numerals absolute -top-2 left-3 grid h-5 min-w-5 place-items-center rounded-[4px] bg-red px-1 text-[0.95rem] leading-none text-white ring-2 ring-surface">
      {n > 99 ? "99+" : n}
    </span>
  );
}

type Item = { id: number; kind: "booking" | "review" | "calendar"; title: string; body: string; when: string; read: boolean };

/** Fifteen notifications, the newest first, like the real bell's limit; the first ones are unread as the state says. */
const POOL: Omit<Item, "id" | "read">[] = [
  { kind: "booking", title: "Мария Иванова предлага оглед", body: "Четвъртък, 19 ноември, 09:00–11:00. Отговори, за да го потвърдиш.", when: "преди 12 мин" },
  { kind: "review", title: "Нов отзив от Десислава Тодорова", body: "5 звезди: „Дойде навреме, работата е чиста и подредена.“", when: "преди 2 ч" },
  { kind: "calendar", title: "Потвърди календара си", body: "Не си го потвърждавал от 8 дни. Клиентите виждат свободни дни само ако са верни.", when: "преди 5 ч" },
  { kind: "booking", title: "Стоян Колев потвърди посещението", body: "Вторник, 24 ноември, цял ден. Адресът е в разговора.", when: "вчера" },
  { kind: "booking", title: "Николай Попов отмени уговорката", body: "Петък, 20 ноември, 14:00. Денят отново е свободен в календара.", when: "вчера" },
  { kind: "review", title: "Нов отзив от Иван Димитров", body: "4 звезди: „Всичко е наред, само се забави с един ден.“", when: "преди 2 дни" },
  { kind: "calendar", title: "Календарът ти е потвърден", body: "Свободните ти дни са актуални до следващата седмица.", when: "преди 3 дни" },
  { kind: "booking", title: "Румен Господинов предлага работа", body: "Понеделник, 23 ноември, цял ден. Чака отговор от теб.", when: "преди 3 дни" },
  { kind: "review", title: "Мария Иванова остави отзив", body: "5 звезди: „Препоръчвам, цената беше точно каквато се разбрахме.“", when: "преди 4 дни" },
  { kind: "booking", title: "Уговорката с Недялко Стоянов е потвърдена", body: "Сряда, 18 ноември, 10:00–12:00.", when: "преди 5 дни" },
  { kind: "calendar", title: "Напомняне: обади се на клиент", body: "Десислава Тодорова: „Да се чуем след празниците.“", when: "преди 6 дни" },
  { kind: "booking", title: "Нова заявка за оглед", body: "Стоян Колев пита за вторник сутринта.", when: "преди седмица" },
  { kind: "review", title: "Нов отзив от Николай Попов", body: "5 звезди: „Видеонаблюдението работи от първия ден.“", when: "преди седмица" },
  { kind: "calendar", title: "Календарът ти е потвърден", body: "Свободните ти дни са актуални.", when: "преди 2 седмици" },
  { kind: "booking", title: "Уговорката е завършена", body: "Оглед при Мария Иванова, четвъртък, 12 ноември.", when: "преди 2 седмици" },
];

const ICON = { booking: CalendarClock, review: Star, calendar: CalendarDays };

/** A static copy of the bell of notification-bell.tsx: its button, the dropdown and „Прочетени“, with the state's count. */
function BellCopy({ count, flash }: { count: number; flash: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(count);
  const [items, setItems] = useState<Item[]>(() => POOL.map((p, i) => ({ ...p, id: i, read: i >= count })));
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const readAll = () => {
    setUnread(0);
    setItems((xs) => xs.map((x) => ({ ...x, read: true })));
  };
  const readOne = (id: number) => {
    const it = items.find((x) => x.id === id);
    if (it && !it.read) {
      setItems((xs) => xs.map((x) => (x.id === id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    flash("Проба: тук се отваря известието.");
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="btn btn-ghost btn-sm relative min-h-11 min-w-11"
        aria-label={unread ? `Известия, ${unread} непрочетени` : "Известия"}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="relative">
          <Bell className="size-5" aria-hidden />
          {unread > 0 && <Count n={unread} />}
        </span>
      </button>

      {open && (
        <div
          role="region"
          aria-label="Известия"
          className="unfold-down fixed inset-x-3 top-[4.25rem] z-50 max-h-[70dvh] overflow-y-auto rounded-[10px] bg-surface shadow-[var(--shadow-lg)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem]"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <h2 className="font-extrabold">Известия</h2>
            {unread > 0 && (
              <button type="button" className="inline-flex min-h-11 items-center gap-1 text-sm font-bold underline underline-offset-4" onClick={readAll}>
                <Check className="size-4" aria-hidden /> Прочетени
              </button>
            )}
          </div>
          <ul className="grid gap-1 px-2 pb-2">
            {items.map((n) => {
              const Icon = ICON[n.kind];
              return (
                <li key={n.id}>
                  <button type="button" onClick={() => readOne(n.id)} className="flex w-full gap-3 rounded-[6px] bg-paper px-4 py-3 text-left transition-colors hover:bg-rule-soft/50">
                    <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={`block ${n.read ? "font-semibold" : "font-extrabold"}`}>{n.title}</span>
                      <span className="line-clamp-2 block text-sm text-ink-2">{n.body}</span>
                      <span className="block text-xs text-ink-3">{n.when}</span>
                    </span>
                    {!n.read && <span aria-label="непрочетено" role="img" className="mt-[5px] size-2.5 shrink-0 rounded-full bg-red shadow-[inset_0_0_0_1.5px_rgb(22_20_15/0.75)]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * A static copy of the logged-in craftsman site header (site-header.tsx), fixed over the real one: logo, nav links (from md),
 * the bell, „Съобщения“ (the word from sm), the user menu (from md) or the menu button (below md).
 */
export function SiteHeaderCopy({ messages, bell, flash }: { messages: number; bell: number; flash: (t: string) => void }) {
  const soon = (what: string) => () => flash(`Проба: тук се отваря „${what}“.`);
  return (
    <header className="fixed inset-x-0 top-0 z-[60] bg-surface">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Основна навигация" className="ml-6 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <button key={n} type="button" onClick={soon(n)} className="btn btn-ghost btn-sm font-semibold">
              {n}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <BellCopy count={bell} flash={flash} />
          <button
            type="button"
            className="btn btn-ghost btn-sm relative min-h-11"
            aria-label={messages ? `Съобщения, ${messages} непрочетени` : "Съобщения"}
            onClick={() => flash("Проба: тук се отварят съобщенията.")}
          >
            <span className="relative">
              <MessageCircle className="size-5" aria-hidden />
              {messages > 0 && <span aria-hidden className={PROFILE_DOT_ICON} />}
            </span>
            <span className="relative hidden sm:inline">
              Съобщения
              {messages > 0 && <span aria-hidden className={PROFILE_DOT_WORD} />}
            </span>
          </button>
          <div className="relative hidden md:block">
            <button type="button" className="btn btn-ghost btn-sm gap-2 pl-1" aria-haspopup="menu" aria-label="Меню на профила: Георги Петров" onClick={soon("Моето табло")}>
              <Avatar name="Георги Петров" size={30} />
              <span className="max-w-36 truncate">Георги</span>
              <ChevronDown className="size-4" aria-hidden />
            </button>
          </div>
          <button type="button" className="btn btn-ghost btn-sm min-h-11 md:hidden" aria-label="Меню" onClick={soon("Меню")}>
            <Menu className="size-6" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}
