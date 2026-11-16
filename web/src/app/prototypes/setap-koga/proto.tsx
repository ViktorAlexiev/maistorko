"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";
import { rowOk } from "@/lib/intervals";
import { SameDayToggle, useKalendar, useWeekDraft } from "../kalendar/shared";
import { LentaWeek } from "../kalendar/variant-lenta";
import "../../setap/setap.css";

const HEADING = "display text-5xl sm:text-6xl";

/** Setup step 4 inside the real „Фокус“ frame of /setap: the seven days of „Лента“, the quick schedules, the same-day switch. */
export function KogaProto({ has, today }: { has: boolean; today: string }) {
  // `has`: the saved schedule shows in the days; otherwise every day starts as „почивка“ (round 6)
  const k = useKalendar({ today, chas: "16:40", nov: !has });
  const d = useWeekDraft(k, true);
  const [sameDay, setSameDay] = useState(has && k.shortNotice);

  // „Готово“ of the step saves the days and the switch; with no working day it is „Пропусни“
  const finish = () => {
    if (d.lists.every((l) => l.length === 0)) return void toast("Няма работен ден: продължаваш като с „Пропусни“.");
    if (d.week.some((rows) => rows.some((r) => !rowOk(r)))) return void toast.error("Има интервал, в който краят е преди началото.");
    toast.success(`Графикът е записан${sameDay ? ", идваш и в същия ден" : ""}. В сетъпа оттук продължаваш към последния екран.`);
  };

  return (
    <div className="mx-auto max-w-xl px-4 pb-28 pt-6 sm:pt-10">
      <div className="flex items-center justify-between gap-3">
        <span className="label !mb-0">Стъпка 4 от 4</span>
        <Link href="/tabla" className="inline-flex min-h-11 items-center gap-1.5 font-bold text-ink-2">
          Затвори <X className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="mt-2 flex gap-1" role="img" aria-label="Стъпка 4 от 4">
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`h-2 flex-1 rounded-full ${n === 4 ? "bg-ink" : "bg-rule"}`} />
        ))}
      </div>

      <div className="setap-enter mt-6">
        <button
          type="button"
          className="mb-3 inline-flex min-h-11 items-center gap-1.5 font-bold text-ink-2"
          onClick={() => toast("В сетъпа „Назад“ води към стъпка 3 „Цени“.")}
        >
          <ArrowLeft className="size-4" aria-hidden /> Назад
        </button>
        <h1 className={HEADING}>Кога си свободен?</h1>
        <p className="mb-6 mt-3 text-lg text-ink-2">
          Докосни ден и избери часовете или вземи готов график. Отделни дни и отпуски променяш после в Календар.
        </p>
        <div className="grid gap-5">
          <LentaWeek d={d} first tone="bg-surface" />
          <SameDayToggle k={k} value={{ on: sameDay, set: setSameDay }} />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-paper/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4">
          <button type="button" className="btn btn-ghost" onClick={() => toast("„Пропусни“: нищо не се записва, отиваш на последния екран.")}>
            Пропусни
          </button>
          <button type="button" className="btn btn-primary btn-lg" onClick={finish}>
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
