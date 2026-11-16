"use client";

import {
  BusyPeriods,
  ConfirmField,
  FirstSchedule,
  MonthGrid,
  PageTitle,
  QuickActions,
  Rivet,
  SameDayToggle,
  ScheduleEditor,
  TITLE_LINE,
  todayLine,
  type Kalendar,
} from "./shared";

/** „Месец“: the month grid first, bookings as rivets inside the days, nothing else above it. */
export function VariantMesec({ k }: { k: Kalendar }) {
  if (!k.hasSchedule) {
    return (
      <div className="grid min-w-0 gap-8">
        <PageTitle />
        <FirstSchedule k={k} />
      </div>
    );
  }
  return (
    <div className="grid min-w-0 gap-10">
      <PageTitle line={TITLE_LINE} />

      <section aria-label="Месец" className="min-w-0">
        <MonthGrid k={k} marks />
        <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-2">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-5 rounded-[2px] bg-free" /> свободен
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="hatch h-2.5 w-5 rounded-[2px]" /> частично
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-5 rounded-[2px] bg-surface-2" /> зает
          </li>
          <li className="flex items-center gap-1.5">
            <Rivet kind="confirmed" /> уговорено
          </li>
          <li className="flex items-center gap-1.5">
            <Rivet kind="proposed" /> чака отговор
          </li>
        </ul>
        {k.todayNote && <p className="mt-4 rounded-[10px] bg-surface-2 px-4 py-3 text-[0.95rem] text-ink-2">{todayLine(k)}</p>}
      </section>

      <section aria-label="Бързи действия" className="grid gap-4">
        <QuickActions k={k} layout="row" />
        <SameDayToggle k={k} />
        <BusyPeriods k={k} />
      </section>

      <ConfirmField k={k} />

      <section aria-labelledby="schedule-h" className="min-w-0">
        <h2 id="schedule-h" className="display mb-4 text-4xl">
          Редовен график
        </h2>
        <ScheduleEditor k={k} />
      </section>
    </div>
  );
}
