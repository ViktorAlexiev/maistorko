"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { joinMissing, type Step } from "./steps";

/**
 * „Метър“, approved on 15 November 2026: one short field. The five steps are the parts of the bar itself,
 * each one a link; the three the search needs stand apart from the two that are up to you.
 */
export function VariantMeter({ steps }: { steps: Step[] }) {
  const hidden = steps.some((s) => s.required && !s.done);
  const done = steps.filter((s) => s.done).length;
  // The three the search needs come first, so the next step is always one of them while the profile is hidden
  const next = steps.find((s) => !s.done) ?? steps[0];
  return (
    <section
      aria-labelledby="setup-heading"
      className="grid gap-x-6 gap-y-4 rounded-[10px] bg-surface p-4 [grid-template-areas:'text'_'meter'_'btn'] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5 sm:[grid-template-areas:'text_btn'_'meter_meter']"
    >
      <div className="[grid-area:text]">
        <div className="flex items-baseline gap-3">
          <h2 id="setup-heading" className="text-xl font-extrabold">
            Първи стъпки
          </h2>
          <p className="numerals text-2xl">
            {done}/{steps.length}
            <span className="sr-only"> готови</span>
          </p>
        </div>
        <p className="mt-1 text-ink-2">
          {hidden
            ? `Профилът ти още не се вижда в търсенето. Липсва: ${joinMissing(steps)}.`
            : "Профилът ти се вижда в търсенето. Останалото е по желание."}
        </p>
      </div>
      <Link
        href={next.href}
        className={`btn [grid-area:btn] ${hidden ? "btn-primary" : "btn-outline"}`}
      >
        Продължи: {next.short} <ArrowRight className="size-4" aria-hidden />
      </Link>
      <ol className="flex gap-1 [grid-area:meter]">
        {steps.map((s, i) => (
          <li
            key={s.key}
            className={`min-w-0 flex-1 ${i === 3 ? "ml-2 sm:ml-3" : ""}`}
          >
            <Link
              href={s.href}
              aria-current={s === next ? "step" : undefined}
              className={`flex min-h-16 flex-col justify-between gap-1 rounded-[6px] px-1.5 py-1.5 transition-colors motion-reduce:transition-none sm:px-2.5 ${
                s.done
                  ? "bg-rule hover:bg-rule-deep"
                  : "bg-paper hover:bg-surface-2"
              } ${s === next ? "shadow-[inset_0_0_0_2px_var(--ink)]" : ""}`}
            >
              {s.done ? (
                <Check className="size-4 text-ink" aria-hidden />
              ) : (
                <span className="numerals text-[1.05rem] leading-none text-ink-3">
                  {i + 1}
                </span>
              )}
              <span className="display break-words text-[1.05rem] leading-none sm:text-[1.3rem]">
                {s.short}
                <span className="sr-only">
                  {s.done ? " (готово)" : " (предстои)"}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
