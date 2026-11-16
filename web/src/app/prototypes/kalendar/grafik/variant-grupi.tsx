"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RowList, SlotChips } from "@/app/tabla/kalendar/interval-editor";
import { WEEKDAYS_SHORT } from "@/lib/format";
import { fromRows, rowOk, summary, toRows, type Interval, type Row } from "@/lib/intervals";
import type { SchedulePreset } from "@/lib/schedule-presets";
import {
  daysLabel,
  FirstScheduleFrame,
  groupWeek,
  PresetBar,
  presetWeek,
  SaveBar,
  ScheduleSection,
  type Kalendar,
} from "../shared";

type Group = { key: number; days: number[]; rows: Row[] };
let groupSeq = 0;

/** „Групи“: a summary by groups of days with equal hours; „Промени“ turns it into a group editor. */
export function GrupiSchedule({ k }: { k: Kalendar }) {
  return <GrupiBody key={String(k.hasSchedule)} k={k} first={!k.hasSchedule} />;
}

function GrupiBody({ k, first }: { k: Kalendar; first: boolean }) {
  const fromLists = (lists: Interval[][]): Group[] =>
    groupWeek(lists)
      .filter((g) => g.list.length > 0)
      .map((g) => ({ key: ++groupSeq, days: g.days, rows: toRows(g.list) }));

  const [editing, setEditing] = useState(first);
  const [groups, setGroups] = useState<Group[]>(() => fromLists(k.rules));
  const [exact, setExact] = useState<number | null>(null);

  const lists: Interval[][] = Array.from({ length: 7 }, (_, d) => {
    const g = groups.find((x) => x.days.includes(d));
    return g ? fromRows(g.rows) : [];
  });
  const invalid = groups.some((g) => g.rows.some((r) => !rowOk(r)));
  const dirty = invalid || JSON.stringify(lists) !== JSON.stringify(k.rules);
  const off = lists.flatMap((l, d) => (l.length === 0 ? [d] : []));

  const patch = (key: number, p: Partial<Group>) => setGroups((gs) => gs.map((g) => (g.key === key ? { ...g, ...p } : g)));
  /** A day belongs to one group only: choosing it here takes it from the other one */
  const toggleDay = (key: number, d: number) =>
    setGroups((gs) =>
      gs.map((g) => (g.key === key ? { ...g, days: g.days.includes(d) ? g.days.filter((x) => x !== d) : [...g.days, d] } : { ...g, days: g.days.filter((x) => x !== d) })),
    );
  const applyPreset = (p: SchedulePreset) => setGroups(fromLists(presetWeek(p)));
  const open = () => {
    setGroups(fromLists(k.rules));
    setExact(null);
    setEditing(true);
  };
  const cancel = () => {
    setGroups(fromLists(k.rules));
    setEditing(false);
  };
  const save = () => {
    if (invalid) return void toast.error("Има интервал, в който краят е преди началото.");
    if (first && lists.every((l) => l.length === 0)) return void toast.error("Отбележи поне един работен ден.");
    k.saveRules(lists);
    setEditing(false);
  };

  const tone = first ? "bg-surface" : "bg-paper";
  const editor = (
    <div className="grid gap-4">
      <PresetBar onPick={applyPreset} onClear={() => setGroups([])} />
      <ul className="grid gap-1">
        {groups.map((g, n) => {
          const list = fromRows(g.rows);
          return (
            <li key={g.key} className={`min-w-0 rounded-[6px] ${tone} p-2 sm:p-4`}>
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="numerals min-w-0 text-xl">
                  {g.days.length ? daysLabel(g.days) : "Без дни"} <span className="text-ink-2">{summary(list)}</span>
                </p>
                <button
                  type="button"
                  className="btn btn-ghost size-11 shrink-0 p-0"
                  aria-label={`Премахни група ${n + 1}`}
                  onClick={() => setGroups((gs) => gs.filter((x) => x.key !== g.key))}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1" role="group" aria-label={`Дни на група ${n + 1}`}>
                {WEEKDAYS_SHORT.map((w, d) => (
                  <button
                    key={w}
                    type="button"
                    className="chip min-h-11 px-0 capitalize"
                    aria-pressed={g.days.includes(d)}
                    onClick={() => toggleDay(g.key, d)}
                  >
                    {w}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <SlotChips rows={g.rows} onChange={(rows) => patch(g.key, { rows })} label={`Група ${n + 1}`} />
                <button
                  type="button"
                  className="btn btn-ghost min-h-11 underline underline-offset-4"
                  aria-expanded={exact === g.key}
                  onClick={() => setExact(exact === g.key ? null : g.key)}
                >
                  Точни часове
                </button>
              </div>
              {exact === g.key && (
                <div className={`mt-3 rounded-[8px] ${first ? "bg-paper" : "bg-surface"} p-3`}>
                  <RowList rows={g.rows} onChange={(rows) => patch(g.key, { rows })} idPrefix={`g${g.key}`} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="btn btn-outline btn-lg justify-self-start"
        onClick={() => setGroups((gs) => [...gs, { key: ++groupSeq, days: [], rows: [] }])}
      >
        {groups.length ? "+ Още дни с други часове" : "+ Добави дни и часове"}
      </button>
      <p className="text-ink-2">{off.length ? `Почивни: ${daysLabel(off)}` : "Няма почивни дни."}</p>
    </div>
  );

  if (first) {
    return (
      <FirstScheduleFrame k={k} onSave={save}>
        {editor}
      </FirstScheduleFrame>
    );
  }

  const shown = groupWeek(k.rules);
  return (
    <ScheduleSection help={editing ? "Дните с еднакви часове са в една група. Ден може да е само в една група." : "Дните с еднакви часове са в една група."}>
      {editing ? (
        <>
          {editor}
          <SaveBar invalid={invalid} onCancel={cancel} onSave={save} text={dirty ? undefined : "Няма промени."} />
        </>
      ) : (
        <>
          <ul className="grid gap-1">
            {shown.map((g) => {
              const isOff = g.list.length === 0;
              return (
                <li key={g.days.join()} className={`flex flex-wrap items-baseline gap-x-4 rounded-[6px] px-4 py-3 ${isOff ? "bg-surface-2 text-ink-3" : "bg-paper"}`}>
                  <span className="numerals text-3xl">{daysLabel(g.days)}</span>
                  <span className="numerals text-3xl">{isOff ? "почивка" : summary(g.list).replace(/, /g, " · ")}</span>
                </li>
              );
            })}
          </ul>
          <button type="button" className="btn btn-outline btn-lg justify-self-start" onClick={open}>
            Промени
          </button>
        </>
      )}
    </ScheduleSection>
  );
}
