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

/* ------------------------------------------------------------------------------------------------
 * Planning prototype: the state is local, nothing is saved. Used by the approved variant „Фокус“.
 * ---------------------------------------------------------------------------------------------- */

export type Tree = CategoryNode[];
export type Schedule = null | "weekdays" | "monsat" | "evenings";
export type StepNo = 1 | 2 | 3 | 4 | 5;

export type SetupData = {
  /** ticked subcategory ids (a top category without children: its own id) */
  categories: ReadonlySet<number>;
  /** city slug */
  city: string;
  areas: string[];
  /** one price box per ticked subcategory */
  boxes: Record<number, BoardBox>;
  schedule: Schedule;
};

export const STEP_TITLES: Record<1 | 2 | 3 | 4, string> = {
  1: "Какво работиш?",
  2: "Къде работиш?",
  3: "Колко вземаш?",
  4: "Кога си свободен?",
};
export const STEP_NAMES: Record<1 | 2 | 3 | 4, string> = {
  1: "Какво работиш",
  2: "Къде работиш",
  3: "Колко вземаш",
  4: "Кога си свободен",
};

export const DEMO_NAME = "Стоян Колев";

type Sub = { id: number; name: string; topId: number; topName: string };

function subsOf(top: CategoryNode): Sub[] {
  const rows = top.children.length ? top.children : [{ id: top.id, name: top.name }];
  return rows.map((c) => ({ id: c.id, name: c.name, topId: top.id, topName: top.name }));
}

const emptyBox = (s: Sub): BoardBox => ({ id: s.id, name: s.name, kind: null, price: "", unit: "job" });

export type Missing = { label: string; step: 1 | 3 | 4 };

export type SetupDemo = {
  tree: Tree;
  cities: City[];
  step: StepNo;
  goTo: (n: StepNo) => void;
  next: () => void;
  skip: () => void;
  back: () => void;
  saved: SetupData;
  draft: SetupData;
  /** what the preview shows: the draft of the current step over the saved rest */
  view: SetupData;
  /** steps 1..4 that "Напред" was pressed on (or that started saved) */
  done: ReadonlySet<number>;
  toggleCategory: (id: number, on: boolean) => void;
  setPlace: (city: string, areas: string[]) => void;
  setBox: (box: BoardBox) => void;
  setSchedule: (s: Schedule) => void;
  /** saved ticked subcategories, in the order of the tree */
  savedSubs: Sub[];
  /** the box of a subcategory in the given data (an empty one when none yet) */
  boxIn: (data: SetupData, id: number) => BoardBox;
  topNamesOf: (data: SetupData) => string[];
  cityName: string | null;
  visible: boolean;
  missing: Missing[];
};

// A box is saved only when it has a price the real save accepts: „по оглед“, or a sum above 0
const validBox = (b: BoardBox) =>
  b.kind === "quote" || (b.kind != null && /^\d+([.,]\d{1,2})?$/.test(b.price.trim()) && Number(b.price.trim().replace(",", ".")) > 0);
const validBoxes = (boxes: Record<number, BoardBox>) =>
  Object.fromEntries(Object.entries(boxes).filter(([, b]) => validBox(b))) as Record<number, BoardBox>;

const sliceOf = (d: SetupData, n: number): Partial<SetupData> =>
  n === 1 ? { categories: d.categories } : n === 2 ? { city: d.city, areas: d.areas } : n === 3 ? { boxes: validBoxes(d.boxes) } : { schedule: d.schedule };

function initialCity(cities: City[]): string {
  return cities.find((c) => c.slug === "plovdiv")?.slug ?? cities.find((c) => c.is_major)?.slug ?? cities[0]?.slug ?? "";
}

function initialState(tree: Tree, cities: City[], demo: string | undefined): { saved: SetupData; done: number[] } {
  const saved: SetupData = { categories: new Set(), city: initialCity(cities), areas: [], boxes: {}, schedule: null };
  if (demo !== "ready" && demo !== "part") return { saved, done: [] };

  const vik = tree.find((t) => t.name === "ВиК") ?? tree[0];
  const subs = vik ? vik.children : [];
  const leaks = subs.find((c) => c.name === "Течове");
  const pipes = subs.find((c) => c.name === "Водопровод");
  const picked = [leaks, pipes].filter((c): c is NonNullable<typeof c> => Boolean(c));
  saved.categories = new Set(picked.map((c) => c.id));
  if (demo === "part") return { saved, done: [1] };

  const boxes: Record<number, BoardBox> = {};
  if (leaks) boxes[leaks.id] = { id: leaks.id, name: leaks.name, kind: "hour", price: "28", unit: "hour" };
  if (pipes) boxes[pipes.id] = { id: pipes.id, name: pipes.name, kind: "quote", price: "", unit: "job" };
  saved.boxes = boxes;
  saved.schedule = "weekdays";
  return { saved, done: [1, 2, 3, 4] };
}

export function useSetupDemo(tree: Tree, cities: City[], opts: { stapka?: string; demo?: string }): SetupDemo {
  const [init] = useState(() => initialState(tree, cities, opts.demo));
  const [saved, setSaved] = useState<SetupData>(init.saved);
  const [draft, setDraft] = useState<SetupData>(init.saved);
  const [done, setDone] = useState<ReadonlySet<number>>(() => new Set(init.done));
  const [step, setStep] = useState<StepNo>(() => {
    const n = Number(opts.stapka);
    return n >= 1 && n <= 5 && Number.isInteger(n) ? (n as StepNo) : 1;
  });

  const subs = tree.flatMap(subsOf);
  const subById = new Map(subs.map((s) => [s.id, s]));

  const boxIn = (data: SetupData, id: number): BoardBox => {
    const s = subById.get(id);
    return data.boxes[id] ?? (s ? emptyBox(s) : { id, name: "", kind: null, price: "", unit: "job" });
  };

  const next = () => {
    if (step > 4) return;
    setSaved((s) => {
      const part = sliceOf(draft, step);
      // an emptied city select keeps the registration city
      return { ...s, ...part, ...(step === 2 && !draft.city ? { city: s.city } : null) };
    });
    setDone((d) => new Set(d).add(step));
    setStep((step + 1) as StepNo);
  };
  const skip = () => {
    if (step > 4) return;
    setDraft((d) => ({ ...d, ...sliceOf(saved, step) }));
    setStep((step + 1) as StepNo);
  };
  const back = () => setStep((s) => (s > 1 ? ((s - 1) as StepNo) : s));

  const view: SetupData = {
    categories: step === 1 ? draft.categories : saved.categories,
    city: step === 2 && draft.city ? draft.city : saved.city,
    areas: step === 2 ? draft.areas : saved.areas,
    boxes: step === 3 ? draft.boxes : saved.boxes,
    schedule: step === 4 ? draft.schedule : saved.schedule,
  };

  const hasCategory = saved.categories.size >= 1;
  const hasPrice = Array.from(saved.categories).some((id) => saved.boxes[id]?.kind);
  const hasSchedule = saved.schedule !== null;
  const missing: Missing[] = [];
  if (!hasCategory) missing.push({ label: "Какво работиш", step: 1 });
  if (!hasPrice) missing.push({ label: "Цени", step: 3 });
  if (!hasSchedule) missing.push({ label: "Кога си свободен", step: 4 });

  return {
    tree,
    cities,
    step,
    goTo: setStep,
    next,
    skip,
    back,
    saved,
    draft,
    view,
    done,
    toggleCategory: (id, on) =>
      setDraft((d) => {
        const n = new Set(d.categories);
        if (on) n.add(id);
        else n.delete(id);
        return { ...d, categories: n };
      }),
    setPlace: (city, areas) => setDraft((d) => ({ ...d, city, areas: areas.filter((a) => a !== city) })),
    setBox: (box) => setDraft((d) => ({ ...d, boxes: { ...d.boxes, [box.id]: box } })),
    setSchedule: (schedule) => setDraft((d) => ({ ...d, schedule })),
    savedSubs: subs.filter((s) => saved.categories.has(s.id)),
    boxIn,
    topNamesOf: (data) => tree.filter((t) => subsOf(t).some((s) => data.categories.has(s.id))).map((t) => t.name),
    cityName: cities.find((c) => c.slug === saved.city)?.name ?? null,
    visible: hasCategory && hasPrice && hasSchedule,
    missing,
  };
}

/* ------------------------------------------------------------------------------------------------
 * Schedules
 * ---------------------------------------------------------------------------------------------- */

const DAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

export const SCHEDULES: {
  id: Exclude<Schedule, null>;
  label: string;
  /** Mon..Sun: working or not */
  days: boolean[];
  hours: string;
}[] = [
  {
    id: "weekdays",
    label: "Пн–Пт 8–17",
    days: [true, true, true, true, true, false, false],
    hours: "Пн до Пт от 08:00 до 17:00",
  },
  {
    id: "monsat",
    label: "Пн–Сб 8–18",
    days: [true, true, true, true, true, true, false],
    hours: "Пн до Сб от 08:00 до 18:00",
  },
  {
    id: "evenings",
    label: "Вечери и уикенд",
    days: [true, true, true, true, true, true, true],
    hours: "Пн до Пт от 17:00 до 20:30, Сб и Нд от 09:00 до 17:00",
  },
];

/* ------------------------------------------------------------------------------------------------
 * Step bodies
 * ---------------------------------------------------------------------------------------------- */

/** The line under the step heading. */
export function StepLead({ demo, step, className }: { demo: SetupDemo; step: 1 | 2 | 3 | 4; className: string }) {
  if (step === 1) {
    return (
      <p className={className}>
        Отметни конкретните услуги. Клиентите те намират в търсенето по тях.{" "}
        <span className="whitespace-nowrap">
          <span className="numerals text-xl text-ink">{demo.draft.categories.size}</span> избрани
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

export function StepBody({ demo, step }: { demo: SetupDemo; step: 1 | 2 | 3 | 4 }) {
  if (step === 1) return <StepKakvo demo={demo} />;
  if (step === 2) return <StepKade demo={demo} />;
  if (step === 3) return <StepTseni demo={demo} />;
  return <StepKoga demo={demo} />;
}

function StepKakvo({ demo }: { demo: SetupDemo }) {
  const { tree, draft } = demo;
  const [openIds, setOpenIds] = useState<ReadonlySet<number>>(() => {
    const withPicks = tree.filter((t) => subsOf(t).some((s) => draft.categories.has(s.id))).map((t) => t.id);
    return new Set(withPicks.length ? withPicks : tree.slice(0, 1).map((t) => t.id));
  });

  return (
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
                      onChange={(e) => demo.toggleCategory(r.id, e.target.checked)}
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
  );
}

function StepKade({ demo }: { demo: SetupDemo }) {
  return (
    <form
      onSubmit={(e) => e.preventDefault()}
      onChange={(e) => {
        const fd = new FormData(e.currentTarget);
        demo.setPlace(String(fd.get("city") ?? ""), fd.getAll("areas").map(String));
      }}
    >
      <WhereWork cities={demo.cities} initialCity={demo.draft.city} initialAreas={demo.draft.areas} maxAreas={2} />
    </form>
  );
}

function StepTseni({ demo }: { demo: SetupDemo }) {
  if (demo.savedSubs.length === 0) {
    return (
      <div className="grid justify-items-start gap-4 rounded-[8px] bg-paper p-5">
        <p className="text-lg">Още не си избрал какво работиш. Цената се слага на всяка категория.</p>
        <button type="button" className="btn btn-outline max-sm:min-h-11" onClick={() => demo.goTo(1)}>
          Към „Какво работиш“
        </button>
      </div>
    );
  }
  const groups = demo.tree
    .map((top) => ({ top, subs: demo.savedSubs.filter((s) => s.topId === top.id) }))
    .filter((g) => g.subs.length > 0);
  return (
    <div className="grid gap-6">
      {groups.map(({ top, subs }) => (
        <section key={top.id} aria-label={top.name}>
          <h2 className="display mb-2 text-[1.7rem]">{top.name}</h2>
          <div className="grid gap-1">
            {subs.map((s) => {
              const box = demo.boxIn(demo.draft, s.id);
              return (
                <div key={s.id} className={st2.shell}>
                  <div className={st2.head}>
                    <h3 className="display text-3xl">{s.name}</h3>
                    <PriceTag box={box} />
                  </div>
                  <div className={st2.body}>
                    <PriceEditor box={box} onChange={demo.setBox} idp={`setap-${s.id}`} />
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

/** The approved price box of „Цени и услуги“ (classes copied from its `st`). */
const st2 = {
  shell: "grid overflow-hidden rounded-[10px] bg-surface",
  head: "flex items-center justify-between gap-3 bg-rule px-5 py-2.5",
  body: "grid gap-5 p-5",
};

function StepKoga({ demo }: { demo: SetupDemo }) {
  return (
    <div className="grid gap-4">
      <fieldset className="grid gap-1">
        <legend className="sr-only">Обичаен график</legend>
        {SCHEDULES.map((o) => (
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
                checked={demo.draft.schedule === o.id}
                onChange={() => demo.setSchedule(o.id)}
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

export function FinalScreen({ demo, headingClass }: { demo: SetupDemo; headingClass: string }) {
  if (demo.visible) {
    return (
      <div className="grid gap-8">
        <div>
          <h1 className={headingClass}>Профилът ти вече се вижда</h1>
          <p className="mt-3 text-lg text-ink-2">Клиентите в {demo.cityName} вече те намират в търсенето.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/maistori/georgi-petrov" className="btn btn-primary">
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
  return (
    <div className="grid gap-6">
      <div>
        <h1 className={headingClass}>Профилът ти още не се вижда в търсенето</h1>
        <p className="mt-3 text-lg text-ink-2">Липсва:</p>
      </div>
      <ul className="grid gap-1">
        {demo.missing.map((m) => (
          <li key={m.label} className="flex items-center justify-between gap-3 rounded-[8px] bg-surface p-4">
            <span className="font-bold">{m.label}</span>
            <button type="button" className="btn btn-outline btn-sm max-sm:min-h-11" onClick={() => demo.goTo(m.step)}>
              Добави
            </button>
          </li>
        ))}
      </ul>
      <p className="text-ink-2">Можеш да довършиш и по-късно от „Първи стъпки“ в таблото.</p>
      <div>
        <Link href="/tabla" className="btn btn-primary">
          Към таблото
        </Link>
      </div>
    </div>
  );
}
