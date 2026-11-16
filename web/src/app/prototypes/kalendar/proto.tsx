"use client";

import { ProtoHarness } from "../_harness/picker";
import { DaySheet, useKalendar, VacationDialog } from "./shared";
import { VariantDni } from "./variant-dni";
import { VariantMesec } from "./variant-mesec";
import { VariantMetar } from "./variant-metar";

/** The state lives above the picker, so switching a variant keeps every change made so far. */
export function KalendarProto({ v, nov, chas, today }: { v: number; nov: boolean; chas: string; today: string }) {
  const k = useKalendar({ today, chas, nov });
  return (
    <>
      <ProtoHarness names={["Месец", "Метър", "Дни"]} initial={v - 1} position="top">
        {(i) => (i === 0 ? <VariantMesec k={k} /> : i === 1 ? <VariantMetar k={k} /> : <VariantDni k={k} />)}
      </ProtoHarness>
      <DaySheet k={k} />
      <VacationDialog k={k} />
    </>
  );
}
