"use client";

import { Check, ChevronDown, ChevronRight, Pencil, Trash2, Undo2 } from "lucide-react";
import { diffDays, formatDate, formatEur } from "@/lib/format";
import { hasMoney, jobTotal, SOURCE_LABEL, type Job } from "@/lib/jobs";
import {
  act,
  bookingHours,
  BookingState,
  bookingTitle,
  byMonth,
  ChatTag,
  DateBlock,
  Frame,
  JobForm,
  jobHours,
  LEAD,
  type Look,
  NewButton,
  openChat,
  type Orders,
  Report,
  useOrders,
  type Item,
} from "./shared";

/** Boxes without frames: a light panel on the paper, the quieter part inside it one step darker. */
const look: Look = {
  shell: "rounded-[10px] bg-surface",
  head: "flex items-start justify-between gap-3 px-5 pt-5",
  title: "text-xl font-extrabold",
  body: "grid gap-4 p-5",
  panel: "rounded-[8px] bg-paper p-4",
  sum: "flex items-baseline justify-between gap-3 rounded-[6px] bg-surface px-3 py-2.5",
};

const NO_MARKER = "list-none [&::-webkit-details-marker]:hidden";
const label = "mb-2 text-sm font-bold text-ink-3";

const BUCKETS = ["Днес", "Утре", "До една седмица", "По-късно"] as const;
const bucket = (iso: string, today: string) => {
  const n = diffDays(today, iso);
  return n <= 0 ? 0 : n === 1 ? 1 : n <= 7 ? 2 : 3;
};

/** „Дни“: the page is read by the day. Every row starts with its date, opens for the rest, and past work folds away. */
export function VariantDni({ today, pro }: { today: string; pro: boolean }) {
  const o = useOrders(today, pro);
  const groups = BUCKETS.map((name, i) => ({ name, i, items: o.upcoming.filter((x) => bucket(x.date, today) === i) })).filter((g) => g.items.length > 0);
  const months = byMonth(o.history);

  return (
    <Frame>
      <div className="grid max-w-4xl gap-10">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <h1 className="display text-5xl sm:text-6xl">Поръчки</h1>
            <p className="mt-2 max-w-2xl text-lg text-ink-2">{LEAD}</p>
          </div>
          {o.editing === null && <NewButton o={o} className="max-sm:w-full" />}
        </header>

        {o.editing !== null && <JobForm key={o.editing} o={o} look={look} />}

        {o.overdue.length > 0 && (
          <section aria-labelledby="dni-overdue" className="rounded-[10px] bg-rule-soft p-3 sm:p-4">
            <h2 id="dni-overdue" className="px-1 text-xl font-extrabold">
              {o.overdue.length === 1 ? "1 поръчка е минала и чака отметка" : `${o.overdue.length} поръчки са минали и чакат отметка`}
            </h2>
            <p className="px-1 text-sm text-ink-2">Отбележи ги като свършени или ги отмени.</p>
            <ul className="mt-3 grid gap-1">
              {o.overdue.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[6px] bg-surface px-3 py-2.5">
                  <DateBlock iso={j.start_date} today={today} />
                  <div className="min-w-0 flex-1 basis-40">
                    <p className="font-bold">{j.title}</p>
                    <p className="text-sm text-ink-2">
                      <span className="sr-only">{formatDate(j.start_date, true)}, </span>
                      {jobHours(j)} · {SOURCE_LABEL[j.source]}
                    </p>
                  </div>
                  {hasMoney(j) && <p className="numerals text-2xl">{formatEur(jobTotal(j))}</p>}
                  <div className="flex gap-1 max-sm:basis-full">
                    <button type="button" className={`${act} btn-primary max-sm:flex-1`} onClick={() => o.setStatus(j, "done")}>
                      <Check className="size-4" aria-hidden /> Свършена
                    </button>
                    <button type="button" className={`${act} btn-outline max-sm:flex-1`} onClick={() => o.setStatus(j, "cancelled")}>
                      Отмени
                    </button>
                    <button type="button" className={`${act} btn-ghost`} onClick={() => o.setEditing(j.id)} aria-label={`Редактирай ${j.title}`}>
                      <Pencil className="size-4" aria-hidden />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Предстоящи" className="grid gap-7">
          {groups.length === 0 && <p className="rounded-[6px] bg-surface px-3 py-4 text-ink-2">Няма предстояща работа. Когато някой ти се обади, натисни „Нова поръчка“.</p>}
          {groups.map((g) => (
            <div key={g.name}>
              <h2 className={label}>{g.name}</h2>
              <ul className="grid gap-1">
                {g.items.map((x) => (
                  <li key={x.key}>{x.kind === "job" ? <JobRow o={o} j={x.job} date={x.date} under={g.i === 3 ? "month" : "weekday"} /> : <ChatRow x={x} today={today} under={g.i === 3 ? "month" : "weekday"} />}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        {o.history.length > 0 && (
          <details className="group/past">
            <summary className={`flex min-h-11 cursor-pointer items-center gap-2.5 ${NO_MARKER}`}>
              <h2 className="display text-3xl">Свършени и отменени</h2>
              <span className="numerals text-2xl leading-none text-ink-3">{o.history.length}</span>
              <ChevronDown className="size-5 text-ink-3 transition-transform duration-200 group-open/past:rotate-180" aria-hidden />
            </summary>
            <div className="mt-3 grid gap-7">
              {months.map((m) => (
                <div key={m.ym}>
                  <h3 className={`${label} flex items-baseline justify-between gap-3`}>
                    <span>{m.label}</span>
                    {m.done > 0 && (
                      <span>
                        {m.done === 1 ? "1 свършена" : `${m.done} свършени`} · <span className="numerals text-lg text-ink">{formatEur(m.total)}</span>
                      </span>
                    )}
                  </h3>
                  <ul className="grid gap-1">
                    {m.jobs.map((j) => (
                      <li key={j.id}>
                        <JobRow o={o} j={j} date={j.start_date} under="weekday" />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        )}

        <Report o={o} look={look} />
      </div>
    </Frame>
  );
}

/** A job: closed it is the day, the work and the sum; opened it shows the note, the money and what can be done with it. */
function JobRow({ o, j, date, under }: { o: Orders; j: Job; date: string; under: "weekday" | "month" }) {
  const client = o.clientName(j);
  const cancelled = j.status === "cancelled";
  const past = j.status !== "planned";
  const materials = j.materials_by_client ? 0 : j.materials.reduce((n, m) => n + m.amount, 0);
  return (
    <details name="dni-red" className={`group rounded-[6px] ${cancelled ? "bg-surface-2" : "bg-surface"}`}>
      <summary className={`flex min-h-16 cursor-pointer items-center gap-3 px-3 py-2.5 ${NO_MARKER}`}>
        <DateBlock iso={date} today={o.today} under={under} muted={past} />
        <span className="min-w-0 flex-1">
          <span className={`block font-bold ${cancelled ? "text-ink-3" : ""}`}>{j.title}</span>
          <span className={`block text-sm ${cancelled ? "text-ink-3" : "text-ink-2"}`}>
            <span className="sr-only">{formatDate(date, true)}, </span>
            {j.status === "done" && (
              <span className="font-bold text-free">
                <Check className="mb-0.5 inline size-3.5" aria-hidden /> Свършена ·{" "}
              </span>
            )}
            {cancelled && <span className="font-bold">Отменена · </span>}
            {jobHours(j)} · {SOURCE_LABEL[j.source]}
            {client ? ` · ${client}` : ""}
          </span>
        </span>
        {hasMoney(j) && !cancelled && <span className="numerals text-2xl">{formatEur(jobTotal(j))}</span>}
        <ChevronDown className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-3 px-3 pb-3 sm:pl-[4.25rem]">
        {j.note && <p className="text-ink-2">{j.note}</p>}
        {hasMoney(j) && (
          <p className="text-sm text-ink-2">
            {[
              j.labor_price != null && `Труд ${formatEur(j.labor_price)}`,
              j.transport_price != null && `Транспорт ${formatEur(j.transport_price)}`,
              j.materials_by_client ? "Материалите са от клиента" : materials > 0 && `Материали ${formatEur(materials)}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {past ? (
            <button type="button" className={`${act} btn-outline`} onClick={() => o.setStatus(j, "planned")}>
              <Undo2 className="size-4" aria-hidden /> Върни в предстоящи
            </button>
          ) : (
            <>
              <button type="button" className={`${act} btn-outline`} onClick={() => o.setStatus(j, "done")}>
                <Check className="size-4" aria-hidden /> Свършена
              </button>
              <button type="button" className={`${act} btn-ghost`} onClick={() => o.setStatus(j, "cancelled")}>
                Отмени
              </button>
            </>
          )}
          <button type="button" className={`${act} btn-ghost`} onClick={() => o.setEditing(j.id)}>
            <Pencil className="size-4" aria-hidden /> Редактирай
          </button>
          <button type="button" className={`${act} btn-ghost text-danger`} onClick={() => o.remove(j)}>
            <Trash2 className="size-4" aria-hidden /> Изтрий
          </button>
        </div>
      </div>
    </details>
  );
}

/** A visit agreed in the chat: the same row, but it is a link to the conversation and has no buttons. */
function ChatRow({ x, today, under }: { x: Extract<Item, { kind: "chat" }>; today: string; under: "weekday" | "month" }) {
  const b = x.booking;
  return (
    <a
      href={`/saobshtenia/${b.conversation_id}`}
      onClick={openChat(b)}
      className="flex min-h-16 items-center gap-3 rounded-[6px] bg-surface px-3 py-2.5 transition-colors hover:bg-rule-soft"
    >
      <DateBlock iso={x.date} today={today} under={under} />
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{bookingTitle(b)}</span>
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-ink-2">
          <ChatTag />
          <BookingState b={b} className="sm:hidden" />
          <span className="max-sm:basis-full">
            <span className="sr-only">{formatDate(x.date, true)}, </span>
            {bookingHours(b)}
            {b.note ? ` · ${b.note}` : ""}
          </span>
        </span>
      </span>
      <BookingState b={b} className="max-sm:hidden" />
      <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
    </a>
  );
}
