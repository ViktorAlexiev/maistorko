"use client";

import { DaySheet, useKalendar, VacationDialog } from "./shared";
import { VariantMetar } from "./variant-metar";

/** The approved „Метър“ page with the approved „Лента“ schedule. */
export function KalendarProto({ nov, chas, today }: { nov: boolean; chas: string; today: string }) {
  const k = useKalendar({ today, chas, nov });
  return (
    <>
      <VariantMetar k={k} />
      <DaySheet k={k} />
      <VacationDialog k={k} />
    </>
  );
}
