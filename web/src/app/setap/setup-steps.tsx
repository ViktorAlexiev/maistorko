"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { WhereWork } from "@/app/tabla/profil/where-work";
import { st } from "@/app/tabla/profil/profile-parts";
import { PriceEditor, PriceTag } from "@/app/tabla/tseni/price-parts";
import type { BoardBox } from "@/app/tabla/tseni/prices-board";
import type { CategoryNode, City } from "@/lib/data";
import { SCHEDULE_PRESETS, type SchedulePresetId } from "@/lib/schedule-presets";
import type { SetupStatus } from "@/lib/setup-status";

/* ------------------------------------------------------------------------------------------------
 * State shared by the frame (setup-flow.tsx) and the step bodies
 * ---------------------------------------------------------------------------------------------- */

export type StepNo = 1 | 2 | 3 | 4 | 5;

export type SetupData = {
  /** ticked subcategory ids (a top category without children: its own id) */
  categories: ReadonlySet<number>;
  otherServices: string;
  /** city slug */
  city: string;
  areas: string[];
  /** price boxes by subcategory id */
  boxes: Record<number, BoardBox>;
  schedule: SchedulePresetId | null;
};

export type Sub = { id: number; name: string; topId: number; topName: string; leaf: boolean };

export type SetupState = {
  tree: CategoryNode[];
  cities: City[];
  maxAreas: number | null;
  slug: string;
  status: SetupStatus;
  saved: SetupData;
  draft: SetupData;
  /** bumped to reload the uncontrolled „Къде работиш“ block */
  whereKey: number;
  goTo: (n: StepNo) => void;
  toggleCategory: (id: number, on: boolean) => void;
  setOtherServices: (v: string) => void;
  setPlace: (city: string, areas: string[]) => void;
  setBox: (box: BoardBox) => void;
  setSchedule: (s: SchedulePresetId) => void;
  /** saved ticked subcategories that can hold a price box, in the order of the tree */
  savedSubs: Sub[];
  /** the box of a subcategory in the given data (an empty one when none yet) */
  boxIn: (data: SetupData, id: number) => BoardBox;
  cityName: string | null;
};

export const STEP_TITLES: Record<1 | 2 | 3 | 4, string> = {
  1: "Какво работиш?",
  2: "Къде работиш?",
  3: "Колко вземаш?",
  4: "Кога си свободен?",
};

const OTHER_SLUGS = new Set(["drugo", "drugi-uslugi"]);

export function subsOf(top: CategoryNode): Sub[] {
  const rows = top.children.length ? top.children : [{ id: top.id, name: top.name }];
  return rows.map((c) => ({ id: c.id, name: c.name, topId: top.id, topName: top.name, leaf: top.children.length > 0 }));
}

export const emptyBox = (s: { id: number; name: string }): BoardBox => ({ id: s.id, name: s.name, kind: null, price: "", unit: "job" });

/** Is a category with the slug „Друго“ / „Други услуги“ among the ticked ones. */
export function otherPicked(tree: CategoryNode[], categories: ReadonlySet<number>): boolean {
  return tree.some((t) => [t, ...t.children].some((c) => OTHER_SLUGS.has(c.slug) && categories.has(c.id)));
}

/* ------------------------------------------------------------------------------------------------
 * Step bodies
 * ---------------------------------------------------------------------------------------------- */

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

/** The line under the step heading. */
export function StepLead({ state, step, className }: { state: SetupState; step: 1 | 2 | 3 | 4; className: string }) {
  if (step === 1) {
    return (
      <p className={className}>
        Отметни конкретните услуги. Клиентите те намират в търсенето по тях.{" "}
        <span className="whitespace-nowrap">
          <span className="numerals text-xl text-ink">{state.draft.categories.size}</span> избрани
        </span>
      </p>
    );
  }
  const text: Record<2 | 3 | 4, string> = {
    2: "Градът е от регистрацията. Добави и местата наоколо, където ходиш.",
    3: "Сложи цена на всяка категория, която работиш. Може и „По оглед“. Конкретни услуги с тяхна цена добавяш после в „Цени и услуги“.",
    4: "Избери обичайната си седмица. Отделни дни и отпуски променяш после в Календар.",
  };
  return <p className={className}>{text[step]}</p>;
}

export function StepBody({ state, step }: { state: SetupState; step: 1 | 2 | 3 | 4 }) {
  if (step === 1) return <StepKakvo state={state} />;
  if (step === 2) return <StepKade state={state} />;
  if (step === 3) return <StepTseni state={state} />;
  return <StepKoga state={state} />;
}

function StepKakvo({ state }: { state: SetupState }) {
  const { tree, draft } = state;
  const [openIds, setOpenIds] = useState<ReadonlySet<number>>(() => {
    const withPicks = tree.filter((t) => subsOf(t).some((s) => draft.categories.has(s.id))).map((t) => t.id);
    return new Set(withPicks.length ? withPicks : tree.slice(0, 1).map((t) => t.id));
  });

  return (
    <div className="grid gap-6">
      <div className={st.folds}>
        {tree.map((top) => {
          const rows = subsOf(top);
          const count = rows.filter((r) => draft.categories.has(r.id)).length;
          return (
            <details
              key={top.id}
              className={st.fold}
              open={openIds.has(top.id)}
              onToggle={(e) => {
                const now = e.currentTarget.open;
                setOpenIds((s) => {
                  if (s.has(top.id) === now) return s;
                  const n = new Set(s);
                  if (now) n.add(top.id);
                  else n.delete(top.id);
                  return n;
                });
              }}
            >
              <summary className={st.foldSummary}>
                <CategoryIcon name={top.icon} className="size-5 shrink-0 text-ink-2" />
                <span className="flex-1 font-bold">{top.name}</span>
                {count > 0 && (
                  <span className="text-sm text-ink-2">
                    <span className="numerals text-lg text-ink">{count}</span> {count === 1 ? "избрана" : "избрани"}
                  </span>
                )}
                <ChevronRight
                  className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none"
                  aria-hidden
                />
              </summary>
              <ul className={`grid sm:grid-cols-2 sm:gap-x-6 ${st.foldBody}`}>
                {rows.map((r) => (
                  <li key={r.id}>
                    <label className={`cursor-pointer ${st.rowIn}`}>
                      <input
                        type="checkbox"
                        className="check"
                        checked={draft.categories.has(r.id)}
                        onChange={(e) => state.toggleCategory(r.id, e.target.checked)}
                      />
                      {r.name}
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
      {otherPicked(tree, draft.categories) && (
        <div className="max-w-xl">
          <label htmlFor="otherServices" className="label">
            Какво е „Друго“? <span className="font-normal text-ink-3">(по желание)</span>
          </label>
          <input
            id="otherServices"
            name="otherServices"
            className="field"
            maxLength={200}
            value={draft.otherServices}
            onChange={(e) => state.setOtherServices(e.target.value)}
            placeholder="напр. сглобяване на мебели, монтаж на телевизор, дребни поправки"
            aria-describedby="otherServices-hint"
          />
          <p id="otherServices-hint" className="hint">
            Показва се в профила ти и клиентите те намират по тези думи в търсенето.
          </p>
        </div>
      )}
    </div>
  );
}

function StepKade({ state }: { state: SetupState }) {
  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      onChange={(e) => {
        const fd = new FormData(e.currentTarget);
        state.setPlace(String(fd.get("city") ?? ""), fd.getAll("areas").map(String));
      }}
    >
      <WhereWork
        key={state.whereKey}
        cities={state.cities}
        initialCity={state.draft.city}
        initialAreas={state.draft.areas}
        maxAreas={state.maxAreas}
      />
    </form>
  );
}

/** The approved price box of „Цени и услуги“ (classes copied from its `st`). */
const st2 = {
  shell: "grid overflow-hidden rounded-[10px] bg-surface",
  head: "flex items-center justify-between gap-3 bg-rule px-5 py-2.5",
  body: "grid gap-5 p-5",
};

function StepTseni({ state }: { state: SetupState }) {
  if (state.savedSubs.length === 0) {
    return (
      <div className="grid justify-items-start gap-4 rounded-[8px] bg-paper p-5">
        <p className="text-lg">Още не си избрал какво работиш. Цената се слага на всяка категория.</p>
        <button type="button" className="btn btn-outline max-sm:min-h-11" onClick={() => state.goTo(1)}>
          Към „Какво работиш“
        </button>
      </div>
    );
  }
  const groups = state.tree
    .map((top) => ({ top, subs: state.savedSubs.filter((s) => s.topId === top.id) }))
    .filter((g) => g.subs.length > 0);
  return (
    <div className="grid gap-6">
      {groups.map(({ top, subs }) => (
        <section key={top.id} aria-label={top.name}>
          <h2 className="display mb-2 text-[1.7rem]">{top.name}</h2>
          <div className="grid gap-1">
            {subs.map((s) => {
              const box = state.boxIn(state.draft, s.id);
              return (
                <div key={s.id} className={st2.shell}>
                  <div className={st2.head}>
                    <h3 className="display text-3xl">{s.name}</h3>
                    <PriceTag box={box} />
                  </div>
                  <div className={st2.body}>
                    <PriceEditor box={box} onChange={state.setBox} idp={`setap-${s.id}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function StepKoga({ state }: { state: SetupState }) {
  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-1">
        <legend className="sr-only">Обичаен график</legend>
        {SCHEDULE_PRESETS.map((o) => (
          <label
            key={o.id}
            className="grid cursor-pointer gap-3 rounded-[8px] bg-surface p-4 transition-colors has-[:checked]:bg-rule-soft motion-reduce:transition-none"
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="schedule"
                value={o.id}
                className="check"
                checked={state.draft.schedule === o.id}
                onChange={() => state.setSchedule(o.id)}
              />
              <span className="font-bold">{o.label}</span>
            </span>
            <span className="grid grid-cols-7 gap-1" aria-hidden>
              {DAY_LABELS.map((d, i) => (
                <span
                  key={d}
                  className={`rounded-[4px] py-1.5 text-center text-sm font-bold ${o.days[i] ? "bg-rule text-ink" : "bg-surface-2 text-ink-3"}`}
                >
                  {d}
                </span>
              ))}
            </span>
            <span className="text-sm text-ink-2">{o.hours}</span>
          </label>
        ))}
      </fieldset>
      <p className="text-ink-2">
        Работиш по друг график? Нагласяш го подробно в{" "}
        <Link href="/tabla/kalendar" className="link font-bold">
          Календар
        </Link>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Final screen
 * ---------------------------------------------------------------------------------------------- */

export function FinalScreen({ state, headingClass }: { state: SetupState; headingClass: string }) {
  const { status } = state;
  if (status.listed) {
    return (
      <div className="grid gap-8">
        <div>
          <h1 className={headingClass}>Профилът ти вече се вижда</h1>
          <p className="mt-3 text-lg text-ink-2">
            {state.cityName ? `Клиентите в ${state.cityName}` : "Клиентите"} вече те намират в търсенето.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/maistori/${state.slug}`} className="btn btn-primary">
              Виж профила си
            </Link>
            <Link href="/tabla" className="btn btn-outline">
              Към таблото
            </Link>
          </div>
        </div>
        <div className="rounded-[8px] bg-paper p-5">
          <h2 className="text-xl font-extrabold">По желание, когато имаш време</h2>
          <ul className="mt-3 grid gap-1">
            {[
              { href: "/tabla/profil?chast=za-men", label: "Напиши няколко изречения за себе си" },
              { href: "/tabla/snimki", label: "Качи снимки от работа" },
            ].map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="flex min-h-12 items-center justify-between gap-3 rounded-[6px] bg-surface px-3 font-bold"
                >
                  {l.label}
                  <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const missing: { label: string; step: 1 | 3 | 4 }[] = [];
  if (!status.hasCategory) missing.push({ label: "Какво работиш", step: 1 });
  if (!status.hasPrice) missing.push({ label: "Цени", step: 3 });
  if (!status.hasSchedule) missing.push({ label: "Кога си свободен", step: 4 });

  return (
    <div className="grid gap-6">
      <div>
        <h1 className={headingClass}>Профилът ти още не се вижда в търсенето</h1>
        {missing.length > 0 ? (
          <p className="mt-3 text-lg text-ink-2">Липсва:</p>
        ) : (
          <p className="mt-3 text-lg text-ink-2">Профилът ти е скрит от администратор и не се показва в търсенето.</p>
        )}
      </div>
      {missing.length > 0 && (
        <ul className="grid gap-1">
          {missing.map((m) => (
            <li key={m.label} className="flex items-center justify-between gap-3 rounded-[8px] bg-surface p-4">
              <span className="font-bold">{m.label}</span>
              <button type="button" className="btn btn-outline btn-sm max-sm:min-h-11" onClick={() => state.goTo(m.step)}>
                Добави
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-ink-2">Можеш да довършиш и по-късно от „Първи стъпки“ в таблото.</p>
      <div>
        <Link href="/tabla" className="btn btn-primary">
          Към таблото
        </Link>
      </div>
    </div>
  );
}
