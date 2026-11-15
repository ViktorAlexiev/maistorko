"use client";

import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { FinalScreen, StepBody, StepLead, STEP_TITLES, type SetupDemo } from "./shared";
import "./setap.css";

const HEADING = "display text-5xl sm:text-6xl";

/** „Фокус“: one thing per screen, no dashboard around it, the actions fixed at the bottom. */
export function VariantFokus({ demo }: { demo: SetupDemo }) {
  const { step } = demo;

  if (step === 5) {
    return (
      <div className="mx-auto max-w-xl px-4 pb-16 pt-6 sm:pt-10">
        <div key="final" className="setap-enter">
          <FinalScreen demo={demo} headingClass={HEADING} />
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
            className={`h-2 flex-1 rounded-full ${n === step ? "bg-ink" : demo.done.has(n) ? "bg-rule" : "bg-surface-2"}`}
          />
        ))}
      </div>

      <div key={step} className="setap-enter mt-6">
        {step > 1 && (
          <button type="button" className="mb-3 inline-flex min-h-11 items-center gap-1.5 font-bold text-ink-2" onClick={demo.back}>
            <ArrowLeft className="size-4" aria-hidden /> Назад
          </button>
        )}
        <h1 className={HEADING}>{STEP_TITLES[step]}</h1>
        <StepLead demo={demo} step={step} className="mb-6 mt-3 text-lg text-ink-2" />
        <StepBody demo={demo} step={step} />
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-paper/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4">
          <button type="button" className="btn btn-ghost" onClick={demo.skip}>
            Пропусни
          </button>
          <button type="button" className="btn btn-primary btn-lg" onClick={demo.next}>
            {step === 4 ? "Готово" : "Напред"}
          </button>
        </div>
      </div>
    </div>
  );
}
