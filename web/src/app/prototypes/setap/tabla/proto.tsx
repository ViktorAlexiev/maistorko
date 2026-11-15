"use client";

import Link from "next/link";
import { RuleLegend, RuleStrip } from "@/components/rule-strip";
import { demoStrip, stepsFor, type DemoState } from "./steps";
import { VariantMeter } from "./variant-metar";

/** /tabla as a new craftsman sees it, with „Първи стъпки“ in the approved variant „Метър“. */
export function TablaProto({ state }: { state: DemoState }) {
  const steps = stepsFor(state);
  return (
    <div className="grid gap-8">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Здравей, Стоян</h1>
      </div>

      <VariantMeter steps={steps} />

      <section aria-labelledby="next-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="next-heading" className="display text-4xl">
            Твоите следващи 14 дни
          </h2>
          <Link href="/tabla/kalendar" className="btn btn-outline btn-sm">
            Промени календара
          </Link>
        </div>
        <RuleLegend className="mt-2" />
        <div className="mt-3 overflow-x-auto">
          <RuleStrip
            strip={demoStrip(state)}
            size="lg"
            className="min-w-[34rem]"
            label="Твоите свободни дни"
          />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section aria-labelledby="msg-heading">
          <h2 id="msg-heading" className="display text-4xl">
            Съобщения
          </h2>
          <div className="mt-3 grid gap-1 rounded-[10px] border border-line bg-surface p-1.5">
            <p className="p-4 text-ink-2">
              Още няма запитвания. Клиентите ти пишат от профила ти, обикновено
              след като видят свободен ден в календара.
            </p>
          </div>
        </section>
        <section
          aria-labelledby="rep-heading"
          className="rounded-[10px] border border-line bg-surface p-5"
        >
          <h2 id="rep-heading" className="text-lg font-extrabold">
            Репутация
          </h2>
          <p className="mt-3 text-sm text-ink-2">Още нямаш отзиви.</p>
        </section>
      </div>
    </div>
  );
}
