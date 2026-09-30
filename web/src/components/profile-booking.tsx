"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Info, MessageCircle, X } from "lucide-react";
import { RuleLegend, RuleStrip, type DayStatus } from "@/components/rule-strip";
import { ChatDock, OPEN_CHAT, type WorkOption } from "@/components/chat-dock";
import { freeInSlot, minutes, SLOT_DEFS, type Slot } from "@/lib/slots";
import {
  addDaysISO,
  formatDate,
  isoWeekday,
  MONTHS,
  parseISO,
  relativeDay,
  todayISO,
  WEEKDAYS_SHORT,
} from "@/lib/format";

export type DayInfo = { day: string; status: "free" | "partial" | "busy"; ranges: { start: string; end: string }[] };

const CODE: Record<DayInfo["status"], DayStatus> = { free: "F", partial: "P", busy: "B" };

type Props = {
  craftsman: { id: string; name: string; firstName: string; avatar: string | null; slug: string };
  days: DayInfo[];
  stale: boolean;
  workOptions: WorkOption[];
  initialDate?: string;
  me: string | null;
  banned: boolean;
  isSelf: boolean;
  conversationId: string | null;
};

export function ProfileBooking({ craftsman, days, stale, workOptions, initialDate, me, banned, isSelf, conversationId }: Props) {
  const firstName = craftsman.firstName;
  const [today] = useState(todayISO);
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  const [selected, setSelected] = useState<string | null>(initialDate ?? null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [chat, setChat] = useState(false);
  const [ask, setAsk] = useState<{ date: string; slot: Slot | null } | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  // "Пиши на …" buttons elsewhere on the page, and returning from sign-in with #pishi, open the chat
  useEffect(() => {
    const open = () => setChat(true);
    const fromHash = () => location.hash === "#pishi" && open();
    const t = setTimeout(fromHash, 0);
    window.addEventListener(OPEN_CHAT, open);
    window.addEventListener("hashchange", fromHash);
    return () => {
      clearTimeout(t);
      window.removeEventListener(OPEN_CHAT, open);
      window.removeEventListener("hashchange", fromHash);
    };
  }, []);
  const closeChat = useCallback(() => {
    setChat(false);
    setAsk(null);
    if (location.hash === "#pishi") history.replaceState(null, "", location.pathname + location.search);
  }, []);

  const strip = days.slice(0, 14).map((d) => CODE[d.status]).join("");
  const sel = selected ? byDay.get(selected) : undefined;
  const nextFree = days.find((d) => d.day > (selected ?? today) && d.status !== "busy")?.day;

  // Picking a day only shows its hours; writing is a separate, deliberate step.
  function pick(iso: string, reveal = false) {
    setSelected(iso);
    setSlot(null);
    if (reveal) requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  function writeForDay() {
    if (selected) setAsk({ date: selected, slot });
    setChat(true);
  }

  return (
    <>
      <section id="kalendar" aria-labelledby="cal-heading" className="scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="cal-heading" className="display text-4xl">
            Кога е свободен
          </h2>
          <RuleLegend />
        </div>
        {stale && (
          <p className="mt-3 flex items-start gap-2 rounded-[8px] bg-rule-soft px-3 py-2.5 text-sm">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            {firstName} не е потвърждавал графика си скоро. Питайте в чата дали датата е свободна.
          </p>
        )}
        <p className="mt-2 text-ink-2">Изберете ден, за да видите свободните часове.</p>
        <div className="mt-4 overflow-x-auto pb-1">
          <RuleStrip
            strip={strip}
            start={days[0]?.day}
            size="lg"
            unfold
            selected={selected}
            onPick={(iso) => pick(iso)}
            label={`Следващите 14 дни на ${firstName}`}
            className="min-w-[34rem]"
          />
        </div>

        <div ref={panel} className="scroll-mt-28" aria-live="polite">
          {selected && (
            <DayPanel
              key={selected}
              date={selected}
              info={sel}
              firstName={firstName}
              slot={slot}
              onSlot={setSlot}
              nextFree={nextFree}
              onNextFree={() => nextFree && pick(nextFree)}
              onWrite={writeForDay}
              onClose={() => {
                setSelected(null);
                setSlot(null);
              }}
            />
          )}
        </div>

        <MonthView byDay={byDay} today={today} selected={selected} onPick={(d) => pick(d, true)} />
        <p className="mt-3 text-sm text-ink-3">
          Календарът е ориентировъчен. Точният ден и час се уговарят в чата, а после {firstName} ги запазва в
          календара си.
        </p>
      </section>

      <ChatDock
        open={chat}
        onClose={closeChat}
        craftsman={craftsman}
        me={me}
        isSelf={isSelf}
        banned={banned}
        conversationId={conversationId}
        workOptions={workOptions}
        date={selected}
        slot={slot}
        onDate={(d) => {
          setSelected(d);
          setSlot(null);
        }}
        today={today}
        busyDay={sel?.status === "busy"}
        ask={ask}
        onAskUsed={() => setAsk(null)}
      />
    </>
  );
}

/** The hours of one day: a 06–22 bar, the free intervals, and part-of-day choices. */
function DayPanel({
  date,
  info,
  firstName,
  slot,
  onSlot,
  nextFree,
  onNextFree,
  onWrite,
  onClose,
}: {
  date: string;
  info?: DayInfo;
  firstName: string;
  slot: Slot | null;
  onSlot: (s: Slot | null) => void;
  nextFree?: string;
  onNextFree: () => void;
  onWrite: () => void;
  onClose: () => void;
}) {
  const H0 = 6 * 60;
  const H1 = 22 * 60;
  const pct = (m: number) => ((Math.min(Math.max(m, H0), H1) - H0) / (H1 - H0)) * 100;
  const ranges = info?.ranges ?? [];
  const busy = !info || info.status === "busy";

  return (
    <div className="unfold-down mt-4 rounded-[10px] border-[1.5px] border-ink bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-extrabold first-letter:uppercase">{formatDate(date, true)}</h3>
          <p className={`mt-0.5 font-semibold ${busy ? "text-ink-2" : "text-free"}`}>
            {!info
              ? "Няма данни за този ден. Попитайте в чата."
              : busy
                ? `${firstName} е зает този ден.`
                : `Свободен ${ranges.map((r) => `${r.start}–${r.end}`).join(", ")}`}
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Затвори деня">
          <X className="size-5" aria-hidden />
        </button>
      </div>

      {info && (
        <div className="mt-4" aria-hidden>
          <div className="relative h-8 overflow-hidden rounded-[5px] bg-rule shadow-[inset_0_0_0_1px_rgb(22_20_15/0.35)]">
            {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
              <span
                key={h}
                className={`absolute top-0 w-px ${h % 3 === 0 ? "h-3 bg-ink" : "h-1.5 bg-ink/60"}`}
                style={{ left: `${pct(h * 60)}%` }}
              />
            ))}
            {ranges.map((r) => (
              <span
                key={r.start}
                className="absolute bottom-1 h-3 rounded-[2px] bg-free"
                style={{ left: `${pct(minutes(r.start))}%`, width: `${pct(minutes(r.end)) - pct(minutes(r.start))}%` }}
              />
            ))}
          </div>
          <div className="relative mt-1 h-4">
            {[6, 9, 12, 15, 18, 21].map((h) => (
              <span
                key={h}
                className="numerals absolute -translate-x-1/2 text-[0.8rem] text-ink-3"
                style={{ left: `${pct(h * 60)}%` }}
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      )}

      {!busy ? (
        <>
          <fieldset className="mt-3">
            <legend className="text-sm font-bold">Кога ви е удобно?</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SLOT_DEFS.map((s) => {
                const free = freeInSlot(ranges, s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    disabled={!free}
                    aria-pressed={slot === s.key}
                    onClick={() => onSlot(slot === s.key ? null : s.key)}
                    className="chip h-auto min-h-14 flex-col gap-0 px-2 py-1.5 leading-tight disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span>{s.label}</span>
                    <span className="text-[0.75rem] font-medium opacity-80">{free ?? "зает"}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
          <button type="button" className="btn btn-primary mt-4 w-full sm:w-auto" onClick={onWrite}>
            <MessageCircle className="size-4" aria-hidden />
            Пиши за {relativeDay(date).replace(/^във? /, "")}
            {slot ? `, ${SLOT_DEFS.find((s) => s.key === slot)!.label.toLowerCase()}` : ""}
          </button>
        </>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          {nextFree && (
            <button type="button" className="btn btn-outline" onClick={onNextFree}>
              Следващ свободен ден: {relativeDay(nextFree)}
            </button>
          )}
          <button type="button" className="btn btn-ghost underline underline-offset-4" onClick={onWrite}>
            Попитай все пак
          </button>
        </div>
      )}
    </div>
  );
}

function MonthView({
  byDay,
  today,
  selected,
  onPick,
}: {
  byDay: Map<string, DayInfo>;
  today: string;
  selected: string | null;
  onPick: (iso: string) => void;
}) {
  // Rolling six weeks from the current week: never a month of past days
  const [page, setPage] = useState(0);
  const startIso = addDaysISO(addDaysISO(today, 1 - isoWeekday(today)), page * 42);
  const cells: (string | null)[] = Array.from({ length: 42 }, (_, i) => addDaysISO(startIso, i));
  const endIso = cells[41]!;
  const rangeLabel = (a: string, b: string) => {
    const da = parseISO(a);
    const db = parseISO(b);
    return `${da.getUTCDate()} ${MONTHS[da.getUTCMonth()]} – ${db.getUTCDate()} ${MONTHS[db.getUTCMonth()]}`;
  };

  return (
    <div className="mt-6 rounded-[10px] border border-line bg-surface p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setPage((o) => o - 1)}
          disabled={page === 0}
          aria-label="Предишни 6 седмици"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h3 className="text-lg font-extrabold" aria-live="polite">
          {rangeLabel(startIso, endIso)}
        </h3>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setPage((o) => o + 1)}
          disabled={page >= 1}
          aria-label="Следващи 6 седмици"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label="Календар за следващите седмици">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="pb-1 text-xs font-bold uppercase text-ink-3" role="columnheader">
            {w}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e${i}`} />;
          const info = byDay.get(iso);
          const past = iso < today;
          const status = info?.status;
          const d = parseISO(iso).getUTCDate();
          const label = `${formatDate(iso, true)}: ${
            past ? "минал ден" : !info ? "няма данни" : status === "free" ? "свободен" : status === "partial" ? "частично свободен" : "зает"
          }`;
          return (
            <button
              key={iso}
              type="button"
              disabled={past || !info}
              onClick={() => onPick(iso)}
              aria-label={label}
              aria-pressed={selected === iso}
              title={label}
              className={`relative flex h-12 flex-col sm:h-14 items-center justify-center rounded-[6px] transition-colors disabled:cursor-default ${
                past || !info
                  ? "text-ink-3/60"
                  : "hover:bg-rule-soft"
              } ${selected === iso ? "ring-2 ring-red ring-offset-1" : ""}`}
            >
              <span className={`numerals text-lg leading-none ${iso === today ? "text-red" : ""}`}>{d}</span>
              {d === 1 && (
                <span className="absolute left-1 top-0.5 text-[0.6rem] font-bold uppercase text-ink-3">
                  {MONTHS[parseISO(iso).getUTCMonth()].slice(0, 3)}
                </span>
              )}
              {info && !past && status !== "busy" && (
                <span
                  aria-hidden
                  className={`absolute inset-x-1.5 bottom-1.5 h-1.5 rounded-[2px] ${status === "free" ? "bg-free" : "hatch"}`}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
