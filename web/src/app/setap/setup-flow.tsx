"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";
import {
  saveSetupCategories,
  saveSetupPlace,
  saveSetupPrices,
  saveSetupSchedule,
  type SetupResult,
} from "@/app/actions/setup";
import type { BoardBox } from "@/app/tabla/tseni/prices-board";
import type { CategoryNode, City } from "@/lib/data";
import type { SchedulePresetId } from "@/lib/schedule-presets";
import type { SetupStatus } from "@/lib/setup-status";
import type { BoxInput } from "@/lib/write-boxes";
import {
  emptyBox,
  FinalScreen,
  otherPicked,
  StepBody,
  StepLead,
  STEP_TITLES,
  subsOf,
  type SetupData,
  type SetupState,
  type StepNo,
} from "./setup-steps";
import "./setap.css";

export type SetupInitial = {
  step: 1 | 2 | 3 | 4 | 5;
  tree: CategoryNode[];
  cities: City[];
  maxAreas: number | null;
  categoryIds: number[]; // saved ticks
  otherServices: string;
  city: string; // slug
  areas: string[]; // slugs, without the main city
  boxes: Record<number, BoardBox>; // every saved box of the craftsman, by subcategory id
  schedule: SchedulePresetId | null; // matchPreset of the saved schedule
  status: SetupStatus;
  slug: string;
};

const HEADING = "display text-5xl sm:text-6xl";

/** Has the step something saved, by the last known status. */
const savedStep = (s: SetupStatus, n: number) =>
  n === 1 ? s.hasCategory : n === 2 ? s.hasCategory || s.hasArea : n === 3 ? s.hasPrice : s.hasSchedule;

/** The part of the data a step saves. */
function sliceOf(d: SetupData, n: number, tree: CategoryNode[]): Partial<SetupData> {
  if (n === 1) return { categories: d.categories, otherServices: otherPicked(tree, d.categories) ? d.otherServices.trim() : "" };
  if (n === 2) return { city: d.city, areas: d.areas };
  if (n === 3) return { boxes: d.boxes };
  return { schedule: d.schedule };
}

/** „Фокус“: one thing per screen, no dashboard around it, the actions fixed at the bottom. */
export function SetupFlow({ initial }: { initial: SetupInitial }) {
  const { tree, cities } = initial;
  const [init] = useState<SetupData>(() => ({
    categories: new Set(initial.categoryIds),
    otherServices: initial.otherServices,
    city: initial.city,
    areas: initial.areas,
    boxes: initial.boxes,
    schedule: initial.schedule,
  }));
  const [saved, setSaved] = useState<SetupData>(init);
  const [draft, setDraft] = useState<SetupData>(init);
  const [status, setStatus] = useState<SetupStatus>(initial.status);
  const [pressed, setPressed] = useState<ReadonlySet<number>>(() => new Set());
  const [step, setStep] = useState<StepNo>(initial.step);
  const [whereKey, setWhereKey] = useState(0);
  const [pending, setPending] = useState(false);

  const subs = tree.flatMap(subsOf);
  const subById = new Map(subs.map((s) => [s.id, s]));
  const savedSubs = subs.filter((s) => s.leaf && saved.categories.has(s.id));

  const boxIn = (data: SetupData, id: number): BoardBox => {
    const s = subById.get(id);
    return data.boxes[id] ?? (s ? emptyBox(s) : { id, name: "", kind: null, price: "", unit: "job" });
  };

  // The step is in the address; the first load leaves the address alone
  const goTo = (n: StepNo) => {
    setStep(n);
    window.history.replaceState(null, "", `?stapka=${n}`);
  };

  const call = (n: 1 | 2 | 3 | 4): Promise<SetupResult> => {
    if (n === 1) {
      return saveSetupCategories({ categoryIds: Array.from(draft.categories), otherServices: draft.otherServices });
    }
    if (n === 2) return saveSetupPlace({ city: draft.city, areas: draft.areas });
    if (n === 3) {
      const boxes: BoxInput[] = [];
      for (const s of savedSubs) {
        const b = draft.boxes[s.id];
        if (b?.kind) boxes.push({ categoryId: s.id, kind: b.kind, price: b.price, unit: b.unit });
      }
      return saveSetupPrices({ boxes });
    }
    return saveSetupSchedule({ preset: draft.schedule as SchedulePresetId });
  };

  const skip = () => {
    if (pending || step === 5) return;
    setDraft((d) => ({ ...d, ...sliceOf(saved, step, tree) }));
    if (step === 2) setWhereKey((k) => k + 1);
    goTo((step + 1) as StepNo);
  };

  const next = async () => {
    if (pending || step === 5) return;
    const n = step;
    // no schedule chosen: nothing to save, on to the last screen like „Пропусни“
    if (n === 4 && !draft.schedule) return skip();
    setPending(true);
    let res: SetupResult;
    try {
      res = await call(n);
    } catch {
      res = { ok: false, message: "Не успяхме да запишем промяната." };
    }
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    setStatus(res.status);
    setSaved((s) => ({ ...s, ...sliceOf(draft, n, tree) }));
    setPressed((p) => new Set(p).add(n));
    goTo((n + 1) as StepNo);
  };

  const back = () => {
    if (pending || step <= 1) return;
    goTo((step - 1) as StepNo);
  };

  const state: SetupState = {
    tree,
    cities,
    maxAreas: initial.maxAreas,
    slug: initial.slug,
    status,
    saved,
    draft,
    whereKey,
    goTo,
    toggleCategory: (id, on) =>
      setDraft((d) => {
        const n = new Set(d.categories);
        if (on) n.add(id);
        else n.delete(id);
        return { ...d, categories: n };
      }),
    setOtherServices: (otherServices) => setDraft((d) => ({ ...d, otherServices })),
    setPlace: (city, areas) => setDraft((d) => ({ ...d, city, areas: areas.filter((a) => a !== city) })),
    setBox: (box) => setDraft((d) => ({ ...d, boxes: { ...d.boxes, [box.id]: box } })),
    setSchedule: (schedule) => setDraft((d) => ({ ...d, schedule })),
    savedSubs,
    boxIn,
    cityName: cities.find((c) => c.slug === saved.city)?.name ?? null,
  };

  if (step === 5) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-16 pt-6 sm:pt-10">
        <div key="final" className="setap-enter">
          <FinalScreen state={state} headingClass={HEADING} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl px-4 pb-28 pt-6 sm:pt-10">
      <div className="flex items-center justify-between gap-3">
        <span className="label !mb-0">Стъпка {step} от 4</span>
        <Link href="/tabla" className="inline-flex min-h-11 items-center gap-1.5 font-bold text-ink-2">
          Затвори <X className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="mt-2 flex gap-1" role="img" aria-label={`Стъпка ${step} от 4`}>
        {([1, 2, 3, 4] as const).map((n) => (
          <span
            key={n}
            className={`h-2 flex-1 rounded-full ${n === step ? "bg-ink" : pressed.has(n) || savedStep(status, n) ? "bg-rule" : "bg-surface-2"}`}
          />
        ))}
      </div>

      <div key={step} className="setap-enter mt-6">
        {step > 1 && (
          <button type="button" className="mb-3 inline-flex min-h-11 items-center gap-1.5 font-bold text-ink-2" onClick={back}>
            <ArrowLeft className="size-4" aria-hidden /> Назад
          </button>
        )}
        <h1 className={HEADING}>{STEP_TITLES[step]}</h1>
        <StepLead state={state} step={step} className="mb-6 mt-3 text-lg text-ink-2" />
        <StepBody state={state} step={step} />
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-paper/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4">
          <button type="button" className="btn btn-ghost" onClick={skip}>
            Пропусни
          </button>
          <button type="button" className="btn btn-primary btn-lg" onClick={next} disabled={pending}>
            {step === 4 ? "Готово" : "Напред"}
          </button>
        </div>
      </div>
    </div>
  );
}
