"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CalendarOff, ChevronLeft, ChevronRight, Palmtree, Trash2, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { ConfirmCalendarBanner } from "@/components/confirm-calendar";
import { RuleLegend, RuleStrip } from "@/components/rule-strip";
import {
  addDaysISO,
  daysSince,
  formatDate,
  isoWeekday,
  MONTHS,
  parseISO,
  startOfWeekISO,
  todayISO,
  WEEKDAYS,
  WEEKDAYS_SHORT,
} from "@/lib/format";
import {
  add,
  complement,
  endMin,
  fromRows,
  normalize,
  rowOk,
  subtract,
  summary,
  toMin,
  toRows,
  toTime,
  type Interval,
  type Row,
} from "@/lib/intervals";
import { RowList, SlotChips } from "./interval-editor";

type Rule = { id: string; weekday: number; start_time: string; end_time: string };
type Exception = {
  id: string;
  kind: "free" | "busy";
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  created_at: string;
};
type Day = { day: string; status: "free" | "partial" | "busy"; free_hours: number; ranges: { start: string; end: string }[] };

type Props = {
  userId: string;
  initialRules: Rule[];
  initialExceptions: Exception[];
  initialDays: Day[];
  shortNotice: boolean;
  lastConfirmedAt: string;
};

const CODE = { free: "F", partial: "P", busy: "B" } as const;

export function CalendarEditor({ userId, initialRules, initialExceptions, initialDays, shortNotice, lastConfirmedAt }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [today] = useState(todayISO);
  const [exceptions, setExceptions] = useState(initialExceptions);
  const [days, setDays] = useState(initialDays);
  const [tab, setTab] = useState<"month" | "week" | "schedule">(initialRules.length ? "month" : "schedule");
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const [notice, setNotice] = useState(shortNotice);
  const vacation = useRef<HTMLDialogElement>(null);
  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);

  const refresh = useCallback(async () => {
    const [{ data: d }, { data: ex }] = await Promise.all([
      supabase.rpc("availability_days", { p_craftsman: userId, p_from: today, p_days: 70 }),
      supabase
        .from("availability_exceptions")
        .select("id, kind, start_date, end_date, start_time, end_time, note, created_at")
        .eq("craftsman_id", userId)
        .gte("end_date", today)
        .order("start_date"),
    ]);
    if (d) setDays(d as Day[]);
    if (ex) setExceptions(ex as Exception[]);
    router.refresh();
  }, [supabase, userId, today, router]);

  const run = (fn: () => Promise<string | void>) =>
    startBusy(async () => {
      try {
        const msg = await fn();
        await refresh();
        if (msg) toast.success(msg);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Не успяхме да запишем промяната.");
      }
    });

  async function check<T extends { error: { message: string } | null }>(p: PromiseLike<T>) {
    const res = await p;
    if (res.error) throw new Error("Промяната не беше записана. Опитайте отново.");
    return res;
  }

  // -------------------------------------------------------------- actions
  function busyRange(from: string, to: string, note: string, label: string) {
    run(async () => {
      await check(
        supabase.from("availability_exceptions").insert({
          craftsman_id: userId,
          kind: "busy",
          start_date: from,
          end_date: to,
          note,
        }),
      );
      return label;
    });
  }

  function setDay(date: string, mode: "free" | "busy" | "reset") {
    run(async () => {
      await clearDay(date);
      const base = { craftsman_id: userId, start_date: date, end_date: date };
      if (mode === "free") await check(supabase.from("availability_exceptions").insert({ ...base, kind: "free", note: "Свободен" }));
      if (mode === "busy") await check(supabase.from("availability_exceptions").insert({ ...base, kind: "busy", note: "Зает" }));
      setOpenDay(null);
      return mode === "reset" ? "Денят е върнат по графика." : "Денят е обновен.";
    });
  }

  /** Make the day free exactly in `list`: free rows for each interval, busy rows for the gaps. */
  function saveDay(date: string, list: Interval[]) {
    run(async () => {
      await clearDay(date);
      const others = exceptions.filter((e) => !(e.start_date === date && e.end_date === date));
      const same = JSON.stringify(planFor(date, initialRules, others)) === JSON.stringify(list);
      if (!same) {
        const base = { craftsman_id: userId, start_date: date, end_date: date };
        const t = (m: number) => (m >= 24 * 60 ? "24:00" : toTime(m));
        const rows = [
          ...list.map(([a, b]) => ({ ...base, kind: "free" as const, start_time: t(a), end_time: t(b), note: "Свободен" })),
          ...complement(list).map(([a, b]) => ({ ...base, kind: "busy" as const, start_time: t(a), end_time: t(b), note: "Зает" })),
        ];
        await check(supabase.from("availability_exceptions").insert(rows));
      }
      setOpenDay(null);
      return same ? "Денят е по редовния график." : "Часовете за деня са записани.";
    });
  }

  async function clearDay(date: string) {
    await check(
      supabase.from("availability_exceptions").delete().eq("craftsman_id", userId).eq("start_date", date).eq("end_date", date),
    );
  }

  function removeException(id: string) {
    run(async () => {
      await check(supabase.from("availability_exceptions").delete().eq("id", id));
      return "Премахнато.";
    });
  }

  function toggleNotice(v: boolean) {
    setNotice(v);
    startBusy(async () => {
      const { error } = await supabase.from("craftsman_profiles").update({ short_notice: v }).eq("id", userId);
      if (error) {
        setNotice(!v);
        toast.error("Не успяхме да запишем промяната.");
      } else toast.success(v ? "Клиентите виждат, че можеш да дойдеш и в същия ден." : "Спешните поръчки са изключени.");
    });
  }

  const weekStart = startOfWeekISO(today);
  const nextWeekStart = addDaysISO(weekStart, 7);
  const ranges = exceptions.filter((e) => e.start_date !== e.end_date || (e.kind === "busy" && !e.start_time && e.note === "Отпуск"));
  const [daysAgo] = useState(() => daysSince(lastConfirmedAt));

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Календар</h1>
        <p className="mt-2 max-w-2xl text-lg text-ink-2">
          Клиентите виждат кога си свободен и ти пишат за тези дни. Календарът е ориентировъчен: датата се потвърждава в
          чата.
        </p>
      </div>

      <ConfirmCalendarBanner daysAgo={daysAgo} compact />

      {/* Quick actions */}
      <section aria-labelledby="quick-heading" className="grid gap-4">
        <h2 id="quick-heading" className="sr-only">
          Бързи действия
        </h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <button
            type="button"
            className="btn btn-outline btn-lg justify-start"
            disabled={busy}
            onClick={() => busyRange(today, addDaysISO(weekStart, 6), "Зает тази седмица", "Отбелязан си като зает до неделя.")}
          >
            <CalendarOff className="size-5" aria-hidden /> Зает съм тази седмица
          </button>
          <button
            type="button"
            className="btn btn-outline btn-lg justify-start"
            disabled={busy}
            onClick={() =>
              busyRange(nextWeekStart, addDaysISO(nextWeekStart, 6), "Зает следващата седмица", "Следващата седмица е отбелязана като заета.")
            }
          >
            <CalendarOff className="size-5" aria-hidden /> Зает съм следващата седмица
          </button>
          <button
            type="button"
            className="btn btn-outline btn-lg justify-start"
            disabled={busy}
            onClick={() => vacation.current?.showModal()}
          >
            <Palmtree className="size-5" aria-hidden /> Отпуск или по-дълъг период
          </button>
        </div>

        <label className="flex cursor-pointer items-center gap-4 rounded-[10px] border border-line bg-surface p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-[8px] bg-rule">
            <Zap className="size-5" aria-hidden />
          </span>
          <span className="flex-1">
            <span className="block font-extrabold">Мога да дойда и в същия ден</span>
            <span className="block text-sm text-ink-2">Показваме значка „идва и в същия ден“ за спешни поръчки.</span>
          </span>
          <span className="relative inline-flex">
            <input
              type="checkbox"
              role="switch"
              className="peer sr-only"
              checked={notice}
              onChange={(e) => toggleNotice(e.target.checked)}
            />
            <span className="h-7 w-12 rounded-full bg-line-strong transition-colors peer-checked:bg-free peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink" />
            <span className="absolute left-1 top-1 size-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
          </span>
        </label>

        {ranges.length > 0 && (
          <ul className="grid gap-2" aria-label="Заети периоди">
            {ranges.map((r) => (
              <li key={r.id} className="flex items-center gap-3 rounded-[8px] bg-surface-2 px-4 py-2.5">
                <CalendarOff className="size-4 shrink-0 text-ink-2" aria-hidden />
                <span className="flex-1">
                  <strong>{r.note ?? (r.kind === "busy" ? "Зает" : "Свободен")}</strong>{" "}
                  <span className="text-ink-2">
                    {formatDate(r.start_date)}
                    {r.end_date !== r.start_date ? ` – ${formatDate(r.end_date)}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => removeException(r.id)}
                  disabled={busy}
                  aria-label={`Премахни ${r.note ?? "период"} ${formatDate(r.start_date)}`}
                >
                  <Trash2 className="size-4" aria-hidden /> Премахни
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Views */}
      <section aria-label="Изгледи на календара">
        <div role="tablist" aria-label="Изглед" className="flex gap-1 border-b border-ink">
          {(
            [
              ["month", "Месец"],
              ["week", "Седмица"],
              ["schedule", "Редовен график"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              id={`tab-${key}`}
              aria-controls={`panel-${key}`}
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`relative px-4 py-3 font-bold transition-colors ${tab === key ? "text-ink" : "text-ink-3 hover:text-ink"}`}
            >
              {label}
              {tab === key && <span aria-hidden className="absolute inset-x-2 -bottom-px h-[3px] rounded-t bg-red" />}
            </button>
          ))}
        </div>

        <div className="mt-5">
          {tab !== "schedule" && (
            <>
              <RuleLegend className="mb-3" />
              <div className="mb-6 overflow-x-auto">
                <RuleStrip
                  strip={days.slice(0, 14).map((d) => CODE[d.status]).join("")}
                  start={today}
                  size="md"
                  onPick={(iso) => setOpenDay(iso)}
                  selected={openDay}
                  label="Следващите 14 дни: докоснете ден, за да го промените"
                  className="min-w-[32rem]"
                />
              </div>
            </>
          )}
          {tab === "month" && (
            <div role="tabpanel" id="panel-month" aria-labelledby="tab-month">
              <MonthGrid byDay={byDay} today={today} onPick={setOpenDay} />
            </div>
          )}
          {tab === "week" && (
            <div role="tabpanel" id="panel-week" aria-labelledby="tab-week">
              <WeekView byDay={byDay} today={today} onPick={setOpenDay} />
            </div>
          )}
          {tab === "schedule" && (
            <div role="tabpanel" id="panel-schedule" aria-labelledby="tab-schedule">
              <ScheduleEditor userId={userId} initialRules={initialRules} onSaved={refresh} />
            </div>
          )}
        </div>
      </section>

      <DaySheet
        date={openDay}
        info={openDay ? byDay.get(openDay) : undefined}
        exceptions={exceptions}
        plan={openDay ? planFor(openDay, initialRules, exceptions) : []}
        busy={busy}
        onClose={() => setOpenDay(null)}
        onSet={setDay}
        onSave={saveDay}
        onRemoveRange={removeException}
      />
      <VacationDialog
        ref={vacation}
        today={today}
        onSave={(from, to, note) => busyRange(from, to, note || "Отпуск", "Периодът е отбелязан като зает.")}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Month
// ---------------------------------------------------------------------------
function MonthGrid({ byDay, today, onPick }: { byDay: Map<string, Day>; today: string; onPick: (d: string) => void }) {
  const [offset, setOffset] = useState(0);
  const base = parseISO(today);
  const monthStart = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + offset, 1, 12));
  const startIso = monthStart.toISOString().slice(0, 10);
  const lead = isoWeekday(startIso) - 1;
  const n = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0, 12)).getUTCDate();
  const cells = [...Array.from({ length: lead }, () => null), ...Array.from({ length: n }, (_, i) => addDaysISO(startIso, i))];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" className="btn btn-ghost btn-sm" disabled={offset === 0} onClick={() => setOffset((o) => o - 1)} aria-label="Предишен месец">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h3 className="text-xl font-extrabold capitalize" aria-live="polite">
          {MONTHS[monthStart.getUTCMonth()]} {monthStart.getUTCFullYear()}
        </h3>
        <button type="button" className="btn btn-ghost btn-sm" disabled={offset >= 2} onClick={() => setOffset((o) => o + 1)} aria-label="Следващ месец">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="pb-1 text-center text-xs font-bold uppercase text-ink-3">
            {w}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e${i}`} />;
          const d = byDay.get(iso);
          const past = iso < today;
          const st = d?.status;
          return (
            <button
              key={iso}
              type="button"
              disabled={past || !d}
              onClick={() => onPick(iso)}
              aria-label={`${formatDate(iso, true)}: ${past ? "минал" : st === "free" ? "свободен" : st === "partial" ? "частично свободен" : "зает"}`}
              className={`relative flex h-16 flex-col items-start justify-between rounded-[8px] border p-1.5 text-left transition-colors sm:h-20 sm:p-2 ${
                past || !d
                  ? "border-transparent text-ink-3/50"
                  : st === "free"
                    ? "border-free/30 bg-free-soft hover:border-free"
                    : st === "partial"
                      ? "border-line bg-surface hover:border-ink"
                      : "border-line bg-surface-2 hover:border-ink"
              }`}
            >
              <span className={`numerals text-lg leading-none sm:text-xl ${iso === today ? "text-red" : ""}`}>
                {parseISO(iso).getUTCDate()}
              </span>
              {d && !past && (
                <span className="w-full">
                  {st !== "busy" ? (
                    <span className={`block h-1.5 w-full rounded-full ${st === "free" ? "bg-free" : "hatch"}`} />
                  ) : (
                    <span className="block text-[0.7rem] font-bold uppercase text-ink-3">зает</span>
                  )}
                  <span className="mt-0.5 hidden truncate text-[0.7rem] text-ink-2 sm:block">
                    {d.ranges.map((r) => `${r.start.slice(0, 2)}–${r.end.slice(0, 2)}`).join(", ")}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Week: vertical time bars 06–22
// ---------------------------------------------------------------------------
function WeekView({ byDay, today, onPick }: { byDay: Map<string, Day>; today: string; onPick: (d: string) => void }) {
  const [week, setWeek] = useState(0);
  const start = addDaysISO(startOfWeekISO(today), week * 7);
  const dates = Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
  const H0 = 6 * 60;
  const H1 = 22 * 60;
  const pct = (m: number) => ((Math.min(Math.max(m, H0), H1) - H0) / (H1 - H0)) * 100;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" className="btn btn-ghost btn-sm" disabled={week === 0} onClick={() => setWeek((w) => w - 1)} aria-label="Предишна седмица">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h3 className="text-lg font-extrabold" aria-live="polite">
          {formatDate(dates[0])} – {formatDate(dates[6])}
        </h3>
        <button type="button" className="btn btn-ghost btn-sm" disabled={week >= 8} onClick={() => setWeek((w) => w + 1)} aria-label="Следваща седмица">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-[2.25rem_repeat(7,minmax(0,1fr))] gap-1 sm:gap-2">
        <div />
        {dates.map((d) => (
          <div key={d} className="text-center">
            <div className="text-xs font-bold uppercase text-ink-3">{WEEKDAYS_SHORT[isoWeekday(d) - 1]}</div>
            <div className={`numerals text-xl ${d === today ? "text-red" : ""}`}>{parseISO(d).getUTCDate()}</div>
          </div>
        ))}
        <div className="relative h-80">
          {[6, 9, 12, 15, 18, 21].map((h) => (
            <span key={h} className="numerals absolute right-1 -translate-y-1/2 text-xs text-ink-3" style={{ top: `${pct(h * 60)}%` }}>
              {h}
            </span>
          ))}
        </div>
        {dates.map((d) => {
          const info = byDay.get(d);
          const past = d < today;
          return (
            <button
              key={d}
              type="button"
              disabled={past || !info}
              onClick={() => onPick(d)}
              aria-label={`${formatDate(d, true)}: ${info?.ranges.length ? info.ranges.map((r) => `${r.start}–${r.end}`).join(", ") : "зает"}`}
              className="relative h-80 overflow-hidden rounded-[6px] bg-surface-2 ring-1 ring-inset ring-line transition hover:ring-ink disabled:opacity-40"
            >
              {[9, 12, 15, 18, 21].map((h) => (
                <span key={h} aria-hidden className="absolute inset-x-0 h-px bg-line" style={{ top: `${pct(h * 60)}%` }} />
              ))}
              {info?.ranges.map((r) => {
                const s = toMin(r.start);
                const e = r.end === "24:00" ? 24 * 60 : toMin(r.end);
                return (
                  <span
                    key={r.start}
                    className="absolute inset-x-1 rounded-[4px] bg-free"
                    style={{ top: `${pct(s)}%`, height: `${Math.max(pct(e) - pct(s), 2)}%` }}
                  />
                );
              })}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-ink-3">Зелено: свободни часове. Докоснете ден, за да го промените.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Day sheet
// ---------------------------------------------------------------------------
function DaySheet({
  date,
  info,
  exceptions,
  plan,
  busy,
  onClose,
  onSet,
  onSave,
  onRemoveRange,
}: {
  date: string | null;
  info?: Day;
  exceptions: Exception[];
  plan: Interval[];
  busy: boolean;
  onClose: () => void;
  onSet: (date: string, mode: "free" | "busy" | "reset") => void;
  onSave: (date: string, list: Interval[]) => void;
  onRemoveRange: (id: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Rows are reset from the day's plan whenever another day is opened
  const [forDate, setForDate] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  if (date !== forDate) {
    setForDate(date);
    setRows(toRows(plan));
  }
  const invalid = rows.some((r) => !rowOk(r));
  const changed = invalid || JSON.stringify(fromRows(rows)) !== JSON.stringify(plan);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (date && !d.open) d.showModal();
    if (!date && d.open) d.close();
  }, [date]);

  const single = date ? exceptions.filter((e) => e.start_date === date && e.end_date === date) : [];
  const covering = date ? exceptions.filter((e) => e.start_date !== e.end_date && e.start_date <= date && e.end_date >= date) : [];

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-labelledby="day-title" onClick={(e) => e.target === ref.current && ref.current?.close()}>
      {date && (
        <div className="safe-bottom p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="day-title" className="display text-4xl first-letter:uppercase">
                {formatDate(date, true)}
              </h2>
              <p className="mt-1 text-ink-2">
                {info?.status === "busy" || !info?.ranges.length
                  ? "Сега: зает"
                  : `Сега: свободен ${info.ranges.map((r) => `${r.start}–${r.end}`).join(", ")}`}
                {single.length > 0 && " (ръчно променен)"}
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current?.close()} aria-label="Затвори">
              <X className="size-6" aria-hidden />
            </button>
          </div>

          {covering.map((c) => (
            <div key={c.id} className="mt-4 flex items-center gap-3 rounded-[8px] bg-rule-soft px-3 py-2.5 text-sm">
              <span className="flex-1">
                Денят е в период „{c.note ?? "Зает"}“ ({formatDate(c.start_date)} – {formatDate(c.end_date)}). Ако
                промениш часовете по-долу, те важат за този ден вместо периода.
              </span>
              <button type="button" className="btn btn-outline btn-sm" disabled={busy} onClick={() => onRemoveRange(c.id)}>
                Премахни периода
              </button>
            </div>
          ))}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" className="btn btn-lg bg-free text-white hover:bg-free/90" disabled={busy} onClick={() => onSet(date, "free")}>
              Свободен цял ден
            </button>
            <button type="button" className="btn btn-primary btn-lg" disabled={busy} onClick={() => onSet(date, "busy")}>
              Зает цял ден
            </button>
          </div>
          <div className="mt-5 grid gap-3 rounded-[8px] bg-surface-2 p-3">
            <p className="text-sm font-bold">Свободни часове този ден</p>
            <div className="flex flex-wrap gap-2">
              <SlotChips rows={rows} onChange={setRows} />
            </div>
            <RowList rows={rows} onChange={setRows} idPrefix="d" />
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || invalid || !changed}
              onClick={() => onSave(date, fromRows(rows))}
            >
              {invalid ? "Поправи часовете" : "Запази часовете за деня"}
            </button>
            <p className="text-xs text-ink-3">Уговорените в чата посещения се изваждат от свободните часове автоматично.</p>
          </div>
          {single.length > 0 && (
            <button type="button" className="btn btn-ghost mt-4 w-full underline underline-offset-4" disabled={busy} onClick={() => onSet(date, "reset")}>
              Върни деня по редовния график
            </button>
          )}
        </div>
      )}
    </dialog>
  );
}

function VacationDialog({
  ref,
  today,
  onSave,
}: {
  ref: React.RefObject<HTMLDialogElement | null>;
  today: string;
  onSave: (from: string, to: string, note: string) => void;
}) {
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDaysISO(today, 6));
  const [note, setNote] = useState("Отпуск");
  const invalid = to < from;
  return (
    <dialog ref={ref} className="sheet" aria-labelledby="vac-title" onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <form
        className="safe-bottom grid gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (invalid) return;
          onSave(from, to, note.trim());
          ref.current?.close();
        }}
      >
        <div className="flex items-center justify-between">
          <h2 id="vac-title" className="display text-4xl">
            Зает период
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current?.close()} aria-label="Затвори">
            <X className="size-6" aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="v-from" className="label">
              От
            </label>
            <input id="v-from" type="date" min={today} className="field" value={from} onChange={(e) => setFrom(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="v-to" className="label">
              До (включително)
            </label>
            <input
              id="v-to"
              type="date"
              min={from}
              max={addDaysISO(from, 366)}
              className="field"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-invalid={invalid}
              required
            />
          </div>
        </div>
        {invalid && <p className="error-text">Крайната дата е преди началната.</p>}
        <div>
          <label htmlFor="v-note" className="label">
            Бележка <span className="font-normal text-ink-3">(виждате само вие)</span>
          </label>
          <input id="v-note" className="field" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary btn-lg" disabled={invalid}>
          Отбележи като зает
        </button>
      </form>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Weekly recurring schedule
// ---------------------------------------------------------------------------
function ScheduleEditor({ userId, initialRules, onSaved }: { userId: string; initialRules: Rule[]; onSaved: () => Promise<void> }) {
  const supabase = createClient();
  const initial = useMemo(() => {
    const m: Interval[][] = Array.from({ length: 7 }, () => []);
    for (const r of initialRules) m[r.weekday - 1] = add(m[r.weekday - 1], [toMin(r.start_time), endMin(r.end_time)]);
    return m;
  }, [initialRules]);
  const [week, setWeek] = useState<Row[][]>(() => initial.map(toRows));
  const [custom, setCustom] = useState<number | null>(null);
  const [saving, start] = useTransition();
  const lists = week.map(fromRows);
  const invalid = week.some((rows) => rows.some((r) => !rowOk(r)));
  const dirty = invalid || JSON.stringify(lists) !== JSON.stringify(initial);

  const setDayRows = (i: number, rows: Row[]) => setWeek((w) => w.map((d, k) => (k === i ? rows : d)));
  const preset = (fn: (wd: number) => Interval[]) => setWeek(Array.from({ length: 7 }, (_, i) => toRows(normalize(fn(i + 1)))));
  const copyToWeekdays = (i: number) => setWeek((w) => w.map((d, k) => (k < 5 && k !== i ? toRows(fromRows(w[i])) : d)));

  function save() {
    if (invalid) return void toast.error("Има интервал, в който краят е преди началото.");
    start(async () => {
      const rows = lists.flatMap((list, i) =>
        list.map(([a, b]) => ({ craftsman_id: userId, weekday: i + 1, start_time: toTime(a), end_time: b >= 1440 ? "24:00" : toTime(b) })),
      );
      const del = await supabase.from("availability_rules").delete().eq("craftsman_id", userId);
      if (del.error) return void toast.error("Графикът не беше записан.");
      if (rows.length) {
        const ins = await supabase.from("availability_rules").insert(rows);
        if (ins.error) return void toast.error("Графикът не беше записан.");
      }
      setWeek(lists.map(toRows));
      await onSaved();
      toast.success("Редовният график е записан.");
    });
  }

  return (
    <div className="grid gap-5">
      <p className="text-ink-2">
        Кои дни и часове обикновено работиш. В един ден може да има няколко интервала, напр. 08–12 и 15–19. Отделни дни
        и отпуски променяш от „Месец“ или с бързите бутони горе.
      </p>
      <div className="flex flex-wrap gap-2">
        <span className="self-center text-sm font-bold">Бързо:</span>
        <button type="button" className="chip" onClick={() => preset((d) => (d <= 5 ? [[480, 1020]] : []))}>
          Пн–Пт 8–17
        </button>
        <button type="button" className="chip" onClick={() => preset((d) => (d <= 6 ? [[480, 1080]] : []))}>
          Пн–Сб 8–18
        </button>
        <button type="button" className="chip" onClick={() => preset((d) => (d <= 5 ? [[1020, 1230]] : [[540, 1020]]))}>
          Вечери и уикенд
        </button>
        <button type="button" className="chip" onClick={() => preset(() => [])}>
          Изчисти
        </button>
      </div>

      <ul className="grid border-t-[1.5px] border-ink">
        {week.map((rows, i) => (
          <li key={i} className="border-b border-line py-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="w-28 shrink-0">
                <p className="font-extrabold capitalize">{WEEKDAYS[i]}</p>
                <p className="text-sm text-ink-3">{summary(lists[i])}</p>
              </div>
              <div className="flex flex-1 flex-wrap gap-2">
                <SlotChips rows={rows} onChange={(r) => setDayRows(i, r)} label={WEEKDAYS[i]} />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm underline underline-offset-4"
                  aria-expanded={custom === i}
                  onClick={() => setCustom(custom === i ? null : i)}
                >
                  Точни часове
                </button>
              </div>
            </div>
            {custom === i && (
              <div className="mt-3 grid gap-3 rounded-[8px] bg-surface-2 p-3">
                <RowList rows={rows} onChange={(r) => setDayRows(i, r)} idPrefix={`s${i}`} />
                {i < 5 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm justify-self-start underline underline-offset-4"
                    onClick={() => copyToWeekdays(i)}
                  >
                    Същите часове за всички делнични дни
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {!dirty ? (
        <p className="text-sm text-ink-3">Графикът е записан. Промените се виждат веднага в профила ти.</p>
      ) : (
        <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-[10px] bg-ink p-3 text-white shadow-[var(--shadow-lg)]">
          <p className="flex-1 pl-1 text-sm">
            {invalid ? "Поправи часовете, в които краят е преди началото." : "Имате незаписани промени."}
          </p>
          <button type="button" className="btn text-white hover:bg-white/10" disabled={saving} onClick={() => setWeek(initial.map(toRows))}>
            Откажи
          </button>
          <button type="button" className="btn btn-rule" disabled={saving || invalid} onClick={save}>
            {saving ? "Записваме…" : "Запази графика"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * The day's availability from weekly rules and exceptions, before bookings. Same formula as
 * `day_free_ranges` in the database: the newer edit wins between the day's own exceptions and a longer period.
 */
function planFor(date: string, rules: Rule[], exceptions: Exception[]): Interval[] {
  const wd = isoWeekday(date);
  let list = normalize(rules.filter((r) => r.weekday === wd).map((r) => [toMin(r.start_time), endMin(r.end_time)] as Interval));
  const all = exceptions.filter((e) => e.start_date <= date && e.end_date >= date);
  const newest = (xs: Exception[]) => xs.reduce((m, e) => (e.created_at > m ? e.created_at : m), "");
  const singles = all.filter((e) => e.start_date === e.end_date);
  const periods = all.filter((e) => e.start_date !== e.end_date);
  const cover = singles.length && newest(singles) > newest(periods) ? singles : all;
  for (const e of cover)
    if (e.kind === "free") list = add(list, e.start_time && e.end_time ? [toMin(e.start_time), endMin(e.end_time)] : [480, 1200]);
  for (const e of cover)
    if (e.kind === "busy") list = e.start_time && e.end_time ? subtract(list, [toMin(e.start_time), endMin(e.end_time)]) : [];
  return list;
}
