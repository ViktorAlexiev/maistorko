"use client";

import { ProtoHarness } from "../../_harness/picker";
import { DaySheet, useKalendar, VacationDialog, type Kalendar } from "../shared";
import { VariantMetar } from "../variant-metar";
import { ChasovnikSchedule } from "./variant-chasovnik";
import { GrupiSchedule } from "./variant-grupi";
import { LentaSchedule } from "./variant-lenta";

const SECTIONS = [
  (k: Kalendar) => <LentaSchedule k={k} />,
  (k: Kalendar) => <ChasovnikSchedule k={k} />,
  (k: Kalendar) => <GrupiSchedule k={k} />,
];

/** The approved „Метър“ page; only its „Редовен график“ section changes with the variant. The state lives above the picker. */
export function GrafikProto({ v, nov, chas, today }: { v: number; nov: boolean; chas: string; today: string }) {
  const k = useKalendar({ today, chas, nov });
  return (
    <>
      <ProtoHarness names={["Лента", "Часовник", "Групи"]} initial={v - 1} position="top">
        {(i) => <VariantMetar k={k} schedule={SECTIONS[i]} />}
      </ProtoHarness>
      <DaySheet k={k} />
      <VacationDialog k={k} />
    </>
  );
}
