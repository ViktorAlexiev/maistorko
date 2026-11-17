"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarCheck, ExternalLink, X } from "lucide-react";
import { Rating } from "@/components/bits";
import { RuleLegend, RuleStrip } from "@/components/rule-strip";
import { dashboardNav, type NavItem } from "@/lib/dashboard-nav";
import { Rivet, type Room, type RowsProps } from "./shared";

/** „Преглед“: the dashboard home (tabla/page.tsx) with the conversation rows drawn the way the variant draws its own list. */
export function Home({ r, Rows }: { r: Room; Rows: (p: RowsProps) => React.ReactNode }) {
  const craftsman = r.viewer === "craftsman";
  const nav = dashboardNav({ craftsmanSlug: craftsman ? "georgi-petrov" : null, inOrg: false });
  // Everything but „Съобщения“ lives outside the prototype
  const go = (it: NavItem) => (it.href === "/saobshtenia" ? r.goMessages() : r.flash(`Проба: тук се отваря „${it.label}“`));
  const profile = () => r.flash("Проба: тук се отваря публичният профил");
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <StaticNav groups={nav.groups} withProfile={nav.publicHref !== null} unread={r.unreadCount} go={go} profile={profile} />
        <div className="min-w-0">{craftsman ? <CraftsmanHome r={r} Rows={Rows} /> : <ClientHome r={r} Rows={Rows} />}</div>
      </div>
      <StaticBottomBar bar={nav.bar} more={nav.more} withProfile={nav.publicHref !== null} unread={r.unreadCount} go={go} profile={profile} />
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-24 z-50 flex justify-center">
        {r.note && <p className="rounded-[6px] bg-ink px-3 py-2 text-sm font-semibold text-white shadow-[var(--shadow-md)]">{r.note}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ the menus: static copies of dashboard-nav.tsx and dashboard-bottom-bar.tsx */

type NavProps = { unread: number; go: (it: NavItem) => void; profile: () => void; withProfile: boolean };

function StaticNav({ groups, unread, go, profile, withProfile }: NavProps & { groups: NavItem[][] }) {
  return (
    <nav aria-label="Табло" className="hidden lg:-mx-2 lg:block lg:max-h-[calc(100dvh-7rem)] lg:overflow-x-visible lg:overflow-y-auto lg:px-2 lg:sticky lg:top-24">
      <div className="flex items-center gap-1 lg:block">
        {groups.map((group, gi) => (
          <ul key={gi} className={`flex gap-1 lg:grid lg:gap-0 ${gi > 0 ? "lg:mt-[1.125rem]" : ""}`}>
            {group.map((it) => {
              const active = it.href === "/tabla";
              return (
                <li key={it.href}>
                  <button type="button" onClick={() => go(it)} aria-current={active ? "page" : undefined} className="group flex min-h-11 items-center gap-2 whitespace-nowrap text-left lg:min-h-10">
                    <span
                      className={`display rounded-[4px] px-1.5 py-1 text-[1.3rem] transition-colors motion-reduce:transition-none lg:-mx-2 lg:px-2 lg:text-[1.7rem] ${
                        active ? "bg-rule text-ink" : "text-ink-2 group-hover:text-ink lg:text-ink-3"
                      }`}
                    >
                      {it.label}
                    </span>
                    {it.href === "/saobshtenia" && unread > 0 && (
                      <span className="numerals grid h-6 min-w-6 place-items-center rounded-[4px] bg-ink px-1.5 text-[1.05rem] leading-none text-rule">{unread}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ))}
        {withProfile && (
          <button type="button" onClick={profile} className="flex min-h-11 items-center gap-1.5 whitespace-nowrap px-1.5 text-sm font-semibold text-ink-2 hover:text-ink lg:mt-[1.125rem] lg:min-h-10 lg:px-0">
            Публичен профил <ExternalLink className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    </nav>
  );
}

function StaticBottomBar({ bar, more, unread, go, profile, withProfile }: NavProps & { bar: NavItem[]; more: NavItem[][] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const word = (on: boolean) => `display rounded-[4px] px-1.5 py-1 text-[1.3rem] transition-colors motion-reduce:transition-none ${on ? "bg-rule text-ink" : "text-ink-2"}`;
  const press = "touch-manipulation select-none transition-transform duration-150 active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";
  return (
    <>
      <nav aria-label="Табло" className="bottom-nav fixed inset-x-0 bottom-0 z-40 bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_24px_-14px_rgb(22_20_15/0.3)] lg:hidden">
        <ul className="flex items-stretch justify-between px-2">
          {bar.map((it) => {
            const active = it.href === "/tabla";
            return (
              <li key={it.href}>
                <button type="button" onClick={() => go(it)} aria-current={active ? "page" : undefined} className={`relative flex min-h-14 items-center ${press}`}>
                  <span className={word(active)}>{it.label}</span>
                  {it.href === "/saobshtenia" && unread > 0 && (
                    <span className="numerals absolute -right-2 top-0.5 grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-[4px] bg-ink px-1 text-[0.85rem] leading-none text-rule ring-2 ring-surface">
                      {unread}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {more.length > 0 && (
            <li>
              <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} className={`flex min-h-14 min-w-11 items-center justify-center ${press}`}>
                <span className={word(false)}>Още</span>
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
          onClose={() => setOpen(false)}
          onClick={(e) => {
            if (e.target === ref.current) setOpen(false);
          }}
        >
          <div className="safe-bottom relative px-5 pt-5">
            <button type="button" aria-label="Затвори" onClick={() => setOpen(false)} className="btn btn-ghost absolute right-2 top-2 w-11 px-0">
              <X className="size-6" aria-hidden />
            </button>
            {more.map((group, gi) => (
              <ul key={gi} className={`grid ${gi > 0 ? "mt-[1.125rem]" : ""}`}>
                {group.map((it) => (
                  <li key={it.href}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        go(it);
                      }}
                      className="flex min-h-12 w-full items-center text-left"
                    >
                      <span className="display -mx-2 rounded-[4px] px-2 py-1 text-[2rem] text-ink">{it.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ))}
            {withProfile && (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  profile();
                }}
                className="mt-[1.125rem] flex min-h-12 items-center gap-1.5 font-semibold text-ink-2"
              >
                Публичен профил <ExternalLink className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </dialog>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ the sections */

/** Static copy of the look of upcoming-bookings.tsx, drawn as strips instead of ruled lines (The No Hairline Rule). */
function Upcoming({ r, title }: { r: Room; title: string }) {
  const who = r.viewer === "craftsman" ? "Мария Иванова" : "Георги Петров";
  return (
    <section aria-labelledby="bookings-heading">
      <h2 id="bookings-heading" className="display text-4xl">
        {title}
      </h2>
      <ul className="mt-3 grid gap-1">
        <li>
          <button type="button" onClick={() => r.open(r.mainId)} className="flex min-h-14 w-full items-center gap-3 rounded-[6px] bg-surface px-3 py-3 text-left">
            <CalendarCheck className="size-5 shrink-0 text-free" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block font-bold">
                Утре, <span className="numerals text-lg">09:00–11:00</span>
                <span className="font-semibold text-ink-2"> · оглед</span>
              </span>
              <span className="block truncate text-sm text-ink-3">{who} · 19 ноември</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-sm font-bold">
              <Rivet kind="filled" />
              Уговорено
            </span>
          </button>
        </li>
      </ul>
    </section>
  );
}

function Messages({ r, Rows, heading, id }: { r: Room; Rows: (p: RowsProps) => React.ReactNode; heading: string; id: string }) {
  return (
    <section aria-labelledby={id}>
      <div className="flex items-end justify-between">
        <h2 id={id} className="display text-4xl">
          {heading}
        </h2>
        <button type="button" onClick={r.goMessages} className="link min-h-11 text-sm font-bold">
          Всички
        </button>
      </div>
      <div className="mt-3">
        <Rows rows={r.rows.slice(0, 5)} activeId={null} onOpen={r.open} home />
      </div>
    </section>
  );
}

/** A made-up fortnight from today: F free, P partly free, B busy. */
const STRIP = "FFPBBFFFPFFBBF";

function CraftsmanHome({ r, Rows }: { r: Room; Rows: (p: RowsProps) => React.ReactNode }) {
  return (
    <div className="grid gap-8">
      <h1 className="display text-5xl sm:text-6xl">Здравей, Георги</h1>

      <section aria-labelledby="next-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="next-heading" className="display text-4xl">
            Твоите следващи 14 дни
          </h2>
          <button type="button" onClick={() => r.flash("Проба: тук се отваря „Календар“")} className="btn btn-outline btn-sm">
            Промени календара
          </button>
        </div>
        <RuleLegend className="mt-2" />
        <div className="mt-3 overflow-x-auto">
          <RuleStrip strip={STRIP} size="lg" className="min-w-[34rem]" label="Твоите свободни дни" />
        </div>
        <p className="mt-2 text-sm text-ink-3">Графикът е потвърден преди 2 дни.</p>
      </section>

      <Upcoming r={r} title="Предстоящи посещения" />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Messages r={r} Rows={Rows} id="msg-heading" heading={r.unreadCount ? `Нови съобщения (${r.unreadCount})` : "Съобщения"} />
        <section aria-labelledby="rep-heading" className="self-start rounded-[10px] bg-surface p-5">
          <h2 id="rep-heading" className="text-lg font-extrabold">
            Репутация
          </h2>
          <div className="mt-3">
            <Rating avg={4.8} count={12} />
          </div>
          <p className="mt-3 text-sm text-ink-2">
            Екипът е потвърдил телефонния ти номер. Значката „Проверен“ не е проверка на самоличност, умения или документи.
          </p>
          <button type="button" onClick={() => r.flash("Проба: тук се отварят отзивите")} className="link mt-3 inline-block min-h-11 text-sm font-bold">
            Виж отзивите
          </button>
        </section>
      </div>
    </div>
  );
}

function ClientHome({ r, Rows }: { r: Room; Rows: (p: RowsProps) => React.ReactNode }) {
  return (
    <div className="grid gap-10">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Здравей, Мария</h1>
        <p className="mt-2 text-lg text-ink-2">Тук са разговорите ви, запазените майстори и отзивите ви.</p>
      </div>
      <Upcoming r={r} title="Уговорени посещения" />
      <Messages r={r} Rows={Rows} id="c-msg" heading="Разговори" />
    </div>
  );
}
