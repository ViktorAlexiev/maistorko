"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Lock, MessageSquare, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatEur, isoWeekday, MONTHS, MONTHS_SHORT, parseISO, WEEKDAYS_SHORT } from "@/lib/format";
import { jobTotal, shiftMonth, SOURCE_LABEL, type Client, type Job, type JobSource, type JobStatus } from "@/lib/jobs";
import { toMoney } from "@/lib/validation";
import { Bar, Index } from "../tablo-nav/variant-indeks";
import { CLIENTS, demoBookings, demoJobs, type Booking } from "./data";

// ---------------------------------------------------------------------------
// The work on the page: jobs the craftsman wrote down and visits agreed in the chat, in one list.
// ---------------------------------------------------------------------------

export type Item = { kind: "job"; key: string; date: string; job: Job } | { kind: "chat"; key: string; date: string; booking: Booking };

const later = (a: string, b: string) => (a > b ? a : b);

export function useOrders(today: string, pro: boolean, open = false) {
  const [jobs, setJobs] = useState(() => demoJobs(today));
  const [clients, setClients] = useState(CLIENTS);
  const [editing, setEditingRaw] = useState<string | "new" | null>(open ? "new" : null);
  // A form opened by the address (?forma=1) must not take the focus: the keys 1/2/3 of the picker would type into it.
  const [quiet, setQuiet] = useState(open);
  const setEditing = (v: string | "new" | null) => {
    setQuiet(false);
    setEditingRaw(v);
  };
  const bookings = useMemo(() => demoBookings(today), [today]);

  const setStatus = (j: Job, status: JobStatus) => {
    setJobs((all) => all.map((x) => (x.id === j.id ? { ...x, status } : x)));
    toast.success(
      status === "done"
        ? "Отбелязана като свършена."
        : status === "cancelled"
          ? "Поръчката е отменена и часовете са свободни."
          : "Поръчката е върната в предстоящи.",
    );
  };
  const remove = (j: Job) => {
    if (!window.confirm(`Да изтрия ли „${j.title}“? Часовете ѝ ще се освободят в календара.`)) return;
    setJobs((all) => all.filter((x) => x.id !== j.id));
    toast.success("Поръчката е изтрита.");
  };
  const save = (job: Job, newClient?: Client) => {
    if (newClient) setClients((all) => [...all, newClient]);
    setJobs((all) => (all.some((x) => x.id === job.id) ? all.map((x) => (x.id === job.id ? job : x)) : [...all, job]));
    toast.success(editing === "new" ? "Поръчката е записана и часовете са заети в календара." : "Поръчката е обновена.");
    setEditing(null);
  };

  const order = (a: Item, b: Item) => a.date.localeCompare(b.date) || startOf(a).localeCompare(startOf(b));
  const upcoming: Item[] = [
    ...jobs
      .filter((j) => j.status === "planned" && j.end_date >= today)
      .map((j): Item => ({ kind: "job", key: j.id, date: later(j.start_date, today), job: j })),
    ...bookings.map((b): Item => ({ kind: "chat", key: b.id, date: b.booking_date, booking: b })),
  ].sort(order);
  const overdue = jobs.filter((j) => j.status === "planned" && j.end_date < today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const history = jobs.filter((j) => j.status !== "planned").sort((a, b) => b.start_date.localeCompare(a.start_date));
  const clientName = (j: Job) => clients.find((c) => c.id === j.client_id)?.name;

  return { today, pro, jobs, clients, editing, quiet, setEditing, setStatus, remove, save, upcoming, overdue, history, clientName };
}

export type Orders = ReturnType<typeof useOrders>;

const startOf = (i: Item) => (i.kind === "job" ? i.job.start_time : i.booking.start_time) ?? "00:00";

/** Past jobs by month, newest first, with what the finished ones brought in. */
export function byMonth(history: Job[]) {
  const months: { ym: string; label: string; jobs: Job[]; done: number; total: number }[] = [];
  for (const j of history) {
    const ym = j.start_date.slice(0, 7);
    let m = months.find((x) => x.ym === ym);
    if (!m) {
      const [y, mo] = ym.split("-").map(Number);
      m = { ym, label: `${cap(MONTHS[mo - 1])} ${y}`, jobs: [], done: 0, total: 0 };
      months.push(m);
    }
    m.jobs.push(j);
    if (j.status === "done") {
      m.done += 1;
      m.total += jobTotal(j);
    }
  }
  return months;
}

// ---------------------------------------------------------------------------
// Words and small parts of the page.
// ---------------------------------------------------------------------------

export const cap = (t: string) => t.charAt(0).toLocaleUpperCase("bg") + t.slice(1);

export const shortDate = (iso: string) => {
  const d = parseISO(iso);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
};

/** "09:00–11:00", "цял ден", "до 26 ноември, цели дни" */
export const jobHours = (j: Job) =>
  j.end_date !== j.start_date ? `до ${formatDate(j.end_date)}, цели дни` : j.start_time ? `${j.start_time.slice(0, 5)}–${j.end_time!.slice(0, 5)}` : "цял ден";

export const bookingHours = (b: Booking) =>
  b.end_date ? `до ${formatDate(b.end_date)}, цели дни` : b.start_time ? `${b.start_time.slice(0, 5)}–${b.end_time!.slice(0, 5)}` : "цял ден";

export const bookingTitle = (b: Booking) => `${b.kind === "inspection" ? "Оглед" : "Работа"} при ${b.partner_name}`;

/** Row buttons: 36px with a pointer, 44px under a thumb. */
export const act = "btn btn-sm max-sm:min-h-11";

export const openChat = (b: Booking) => (e: React.MouseEvent) => {
  e.preventDefault();
  toast(`В продукта това отваря разговора с ${b.partner_name}.`);
};

export function ChatTag() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-[4px] bg-rule-soft px-1.5 py-0.5 text-xs font-bold text-ink">
      <MessageSquare className="size-3" aria-hidden /> от чата
    </span>
  );
}

/** The state of a chat visit, with the same words and colours as „Уговорки“ on the overview. */
export function BookingState({ b, className = "" }: { b: Booking; className?: string }) {
  const confirmed = b.status === "confirmed";
  const mine = b.status === "proposed" && !b.proposed_by_me;
  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${
        confirmed ? "bg-free text-white" : mine ? "bg-red text-white" : "bg-rule-soft text-ink"
      } ${className}`}
    >
      {confirmed ? "Уговорено" : mine ? "Отговори" : "Чака отговор"}
    </span>
  );
}

/** The day as it is printed on the rule: a condensed numeral, red for today, with the weekday or the month under it. */
export function DateBlock({ iso, today, under = "weekday", muted }: { iso: string; today: string; under?: "weekday" | "month"; muted?: boolean }) {
  const d = parseISO(iso);
  return (
    <span className="w-11 shrink-0 text-center" aria-hidden>
      <span className={`numerals block text-[1.9rem] leading-none ${muted ? "text-ink-3" : iso === today ? "text-red" : ""}`}>{d.getUTCDate()}</span>
      <span className="mt-0.5 block text-xs font-bold text-ink-3">
        {under === "month" ? MONTHS_SHORT[d.getUTCMonth()] : WEEKDAYS_SHORT[isoWeekday(iso) - 1]}
      </span>
    </span>
  );
}

export const LEAD =
  "Цялата ти работа на едно място. Уговорките от чата идват сами, а работата от обаждане или препоръка я записваш ти и часовете ѝ стават заети в календара.";

export function NewButton({ o, className = "" }: { o: Orders; className?: string }) {
  return (
    <button type="button" className={`btn btn-primary btn-lg ${className}`} onClick={() => o.setEditing("new")}>
      <Plus className="size-5" aria-hidden /> Нова поръчка
    </button>
  );
}

// ---------------------------------------------------------------------------
// The dashboard frame with the approved „Индекс“ navigation, „Поръчки“ current.
// ---------------------------------------------------------------------------

const elsewhere = () => void toast("В тази проба работи само „Поръчки“.");

export function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="proto-nolines mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-10 lg:pb-10">
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <Index active="porachki" pick={elsewhere} />
          </div>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
      <div className="lg:hidden">
        <Bar active="porachki" pick={elsewhere} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The form for a new or edited job. The page gives the box (`look` in variant-dni.tsx); the fields are the ones the product has today.
// ---------------------------------------------------------------------------

/** How a box is drawn now that frames are gone. */
export type Look = {
  /** the box around the whole form */
  shell: string;
  /** the row with the heading and the close button */
  head: string;
  /** the heading */
  title: string;
  /** around the fields */
  body: string;
  /** a quieter box inside the form or on the page: the Pro part, the note about a locked function */
  panel: string;
  /** one row that sums up, inside a panel */
  sum: string;
};

const PRESETS = [
  { key: "day", label: "Цял ден", from: null, to: null },
  { key: "morning", label: "Сутрин", from: "08:00", to: "12:00" },
  { key: "afternoon", label: "Следобед", from: "12:00", to: "17:00" },
  { key: "evening", label: "Вечер", from: "17:00", to: "20:00" },
  { key: "custom", label: "Точни часове", from: "09:00", to: "11:00" },
] as const;
type PresetKey = (typeof PRESETS)[number]["key"];
type MaterialRow = { key: number; name: string; qty: string; amount: string };
type Form = {
  title: string;
  source: JobSource;
  from: string;
  to: string;
  preset: PresetKey;
  timeFrom: string;
  timeTo: string;
  note: string;
  clientMode: "none" | "existing" | "new";
  clientId: string;
  cName: string;
  cPhone: string;
  cAddress: string;
  byClient: boolean;
  labor: string;
  transport: string;
  materials: MaterialRow[];
};

let rowKey = 0;
let newId = 0;

function startForm(j: Job | undefined, today: string): Form {
  if (!j) {
    return {
      title: "",
      source: "phone",
      from: today,
      to: "",
      preset: "day",
      timeFrom: "09:00",
      timeTo: "11:00",
      note: "",
      clientMode: "none",
      clientId: "",
      cName: "",
      cPhone: "",
      cAddress: "",
      byClient: false,
      labor: "",
      transport: "",
      materials: [],
    };
  }
  const preset =
    j.start_time == null
      ? "day"
      : (PRESETS.find((p) => p.from === j.start_time!.slice(0, 5) && p.to === j.end_time!.slice(0, 5) && p.key !== "custom")?.key ?? "custom");
  return {
    title: j.title,
    source: j.source,
    from: j.start_date,
    to: j.end_date !== j.start_date ? j.end_date : "",
    preset,
    timeFrom: j.start_time?.slice(0, 5) ?? "09:00",
    timeTo: j.end_time?.slice(0, 5) ?? "11:00",
    note: j.note ?? "",
    clientMode: j.client_id ? "existing" : "none",
    clientId: j.client_id ?? "",
    cName: "",
    cPhone: "",
    cAddress: "",
    byClient: j.materials_by_client,
    labor: j.labor_price != null ? String(j.labor_price) : "",
    transport: j.transport_price != null ? String(j.transport_price) : "",
    materials: j.materials.map((m) => ({ key: ++rowKey, name: m.name, qty: m.qty ?? "", amount: String(m.amount) })),
  };
}

export function LockNote({ look, children }: { look: Look; children: React.ReactNode }) {
  return (
    <div className={`flex items-start gap-3 ${look.panel}`}>
      <Lock className="mt-0.5 size-5 shrink-0" aria-hidden />
      <p className="text-sm text-ink-2">
        {children}{" "}
        <a
          href="/tabla/plan"
          className="link font-bold text-ink"
          onClick={(e) => {
            e.preventDefault();
            toast("В продукта това води към „План“.");
          }}
        >
          Виж плановете
        </a>
      </p>
    </div>
  );
}

export function JobForm({ o, look }: { o: Orders; look: Look }) {
  const old = o.jobs.find((j) => j.id === o.editing);
  const [form, setForm] = useState<Form>(() => startForm(old, o.today));
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLFormElement>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setMaterial = (key: number, patch: Partial<MaterialRow>) =>
    set("materials", form.materials.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  useEffect(() => {
    if (o.quiet) return;
    box.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    box.current?.querySelector<HTMLInputElement>("#j-title")?.focus({ preventScroll: true });
    // only when the form appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const multiDay = form.to !== "" && form.to > form.from;
  const total =
    (toMoney(form.labor) ?? 0) + (toMoney(form.transport) ?? 0) + (form.byClient ? 0 : form.materials.reduce((n, m) => n + (toMoney(m.amount) ?? 0), 0));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const title = form.title.trim();
    if (!title) return setError("Напиши каква е работата.");
    if (!form.from) return setError("Избери ден.");
    if (form.to && form.to < form.from) return setError("Крайният ден трябва да е след първия.");
    const p = PRESETS.find((x) => x.key === form.preset)!;
    const whole = multiDay || form.preset === "day";
    const from = whole ? null : form.preset === "custom" ? form.timeFrom : p.from;
    const to = whole ? null : form.preset === "custom" ? form.timeTo : p.to;
    if (from && to && to <= from) return setError("Краят трябва да е след началото.");
    for (const f of [form.labor, form.transport, ...form.materials.map((m) => m.amount)]) {
      const v = toMoney(f);
      if (f.trim() !== "" && (v == null || Number.isNaN(v) || v < 0)) return setError("Сумите трябва да са числа, напр. 25 или 12,50.");
    }
    if (form.clientMode === "new" && !form.cName.trim()) return setError("Напиши името на клиента.");

    const created: Client | undefined =
      o.pro && form.clientMode === "new"
        ? { id: `nc${++newId}`, name: form.cName.trim(), phone: form.cPhone.trim() || null, address: form.cAddress.trim() || null, note: null }
        : undefined;
    o.save(
      {
        id: old?.id ?? `nj${++newId}`,
        title,
        source: form.source,
        start_date: form.from,
        end_date: multiDay ? form.to : form.from,
        start_time: from,
        end_time: to,
        status: old?.status ?? "planned",
        note: form.note.trim() || null,
        materials_by_client: form.byClient,
        labor_price: o.pro ? toMoney(form.labor) : (old?.labor_price ?? null),
        transport_price: o.pro ? toMoney(form.transport) : (old?.transport_price ?? null),
        client_id: o.pro ? (created?.id ?? (form.clientMode === "existing" && form.clientId ? form.clientId : null)) : (old?.client_id ?? null),
        done_at: old?.done_at ?? null,
        materials: o.pro
          ? form.materials.filter((m) => m.name.trim()).map((m) => ({ id: `nm${m.key}`, name: m.name.trim(), qty: m.qty.trim() || null, amount: toMoney(m.amount) ?? 0 }))
          : (old?.materials ?? []),
      },
      created,
    );
  }

  return (
    <form ref={box} onSubmit={submit} className={look.shell} noValidate aria-labelledby="j-heading">
      <div className={look.head}>
        <h2 id="j-heading" className={look.title}>
          {old ? "Редакция на поръчка" : "Нова поръчка"}
        </h2>
        <button type="button" className="btn btn-ghost btn-sm -mr-2" onClick={() => o.setEditing(null)} aria-label="Затвори">
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className={look.body}>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <div>
            <label htmlFor="j-title" className="label">
              Каква е работата
            </label>
            <input
              id="j-title"
              className="field"
              value={form.title}
              maxLength={160}
              placeholder="напр. Смяна на бойлер у Петрови"
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="j-source" className="label">
              Откъде е клиентът
            </label>
            <select id="j-source" className="field" value={form.source} onChange={(e) => set("source", e.target.value as JobSource)}>
              {(Object.keys(SOURCE_LABEL) as JobSource[]).map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="j-from" className="label">
              Ден
            </label>
            <input id="j-from" type="date" className="field" value={form.from} onChange={(e) => set("from", e.target.value)} />
          </div>
          <div>
            <label htmlFor="j-to" className="label">
              До ден <span className="font-normal text-ink-3">(ако е за няколко дни)</span>
            </label>
            <input id="j-to" type="date" className="field" min={form.from} value={form.to} onChange={(e) => set("to", e.target.value)} />
          </div>
        </div>
        {multiDay ? (
          <p className="hint -mt-2">
            Всички дни от {shortDate(form.from)} до {shortDate(form.to)} стават заети цели.
          </p>
        ) : (
          <fieldset className="-mt-1">
            <legend className="label">Час</legend>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((x) => (
                <button key={x.key} type="button" className="chip" aria-pressed={form.preset === x.key} onClick={() => set("preset", x.key)}>
                  {x.label}
                  {x.from && x.key !== "custom" && (
                    <span className="text-xs font-medium opacity-75">
                      {x.from.slice(0, 2)}–{x.to.slice(0, 2)}
                    </span>
                  )}
                </button>
              ))}
            </div>
            {form.preset === "custom" && (
              <div className="mt-3 grid max-w-sm grid-cols-2 gap-2">
                <input type="time" step={900} className="field" aria-label="От" value={form.timeFrom} onChange={(e) => set("timeFrom", e.target.value)} />
                <input type="time" step={900} className="field" aria-label="До" value={form.timeTo} onChange={(e) => set("timeTo", e.target.value)} />
              </div>
            )}
          </fieldset>
        )}

        <div>
          <label htmlFor="j-note" className="label">
            Бележка <span className="font-normal text-ink-3">(по желание)</span>
          </label>
          <input id="j-note" className="field" maxLength={1000} value={form.note} onChange={(e) => set("note", e.target.value)} />
        </div>

        {!o.pro ? (
          <LockNote look={look}>Клиентска карта, материали, транспорт и цена на поръчката са в Pro.</LockNote>
        ) : (
          <div className={`grid gap-4 ${look.panel}`}>
            <fieldset>
              <legend className="label">Клиент</legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["none", "Без клиент"],
                    ["existing", "Познат клиент"],
                    ["new", "Нов клиент"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className="chip"
                    aria-pressed={form.clientMode === k}
                    disabled={k === "existing" && o.clients.length === 0}
                    onClick={() => set("clientMode", k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {form.clientMode === "existing" && (
                <select className="field mt-3 max-w-md" aria-label="Клиент" value={form.clientId} onChange={(e) => set("clientId", e.target.value)}>
                  <option value="">Избери клиент</option>
                  {o.clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? `, ${c.phone}` : ""}
                    </option>
                  ))}
                </select>
              )}
              {form.clientMode === "new" && (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <input className="field" placeholder="Име" aria-label="Име на клиента" maxLength={120} value={form.cName} onChange={(e) => set("cName", e.target.value)} />
                  <input className="field" placeholder="Телефон" aria-label="Телефон" maxLength={40} value={form.cPhone} onChange={(e) => set("cPhone", e.target.value)} />
                  <input className="field" placeholder="Адрес" aria-label="Адрес" maxLength={200} value={form.cAddress} onChange={(e) => set("cAddress", e.target.value)} />
                </div>
              )}
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="j-labor" className="label">
                  Труд (€)
                </label>
                <input id="j-labor" className="field" inputMode="decimal" value={form.labor} onChange={(e) => set("labor", e.target.value)} />
              </div>
              <div>
                <label htmlFor="j-transport" className="label">
                  Транспорт (€)
                </label>
                <input id="j-transport" className="field" inputMode="decimal" value={form.transport} onChange={(e) => set("transport", e.target.value)} />
              </div>
            </div>

            <fieldset>
              <legend className="label">Материали</legend>
              <label className="mb-3 flex cursor-pointer items-center gap-2.5">
                <input type="checkbox" className="check" checked={form.byClient} onChange={(e) => set("byClient", e.target.checked)} />
                <span>Материалите ги осигурява клиентът (не влизат в сумата ми)</span>
              </label>
              {!form.byClient && (
                <div className="grid gap-3 sm:gap-2">
                  {form.materials.map((m) => (
                    <div key={m.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_6rem_auto]">
                      <input
                        className="field col-span-3 sm:col-span-1"
                        placeholder="напр. Бойлер 80 л"
                        aria-label="Материал"
                        maxLength={120}
                        value={m.name}
                        onChange={(e) => setMaterial(m.key, { name: e.target.value })}
                      />
                      <input className="field" placeholder="бр." aria-label="Количество" maxLength={40} value={m.qty} onChange={(e) => setMaterial(m.key, { qty: e.target.value })} />
                      <input
                        className="field"
                        placeholder="€"
                        aria-label="Сума"
                        inputMode="decimal"
                        value={m.amount}
                        onChange={(e) => setMaterial(m.key, { amount: e.target.value })}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm min-h-[2.875rem]"
                        aria-label={`Премахни ${m.name || "реда"}`}
                        onClick={() => set("materials", form.materials.filter((x) => x.key !== m.key))}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={`${act} btn-outline justify-self-start`}
                    onClick={() => set("materials", [...form.materials, { key: ++rowKey, name: "", qty: "", amount: "" }])}
                  >
                    <Plus className="size-4" aria-hidden /> Добави материал
                  </button>
                </div>
              )}
            </fieldset>

            <p className={look.sum}>
              <span className="font-bold">Общо за теб</span>
              <span className="numerals text-3xl leading-none">{formatEur(total)}</span>
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">
            {old ? "Запази" : "Запиши поръчката"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => o.setEditing(null)}>
            Откажи
          </button>
        </div>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// „Отчет за месеца“: the same part of the page as today, counted from the jobs above, in boxes without frames.
// ---------------------------------------------------------------------------

export function Report({ o, look }: { o: Orders; look: Look }) {
  const [ym, setYm] = useState(o.today.slice(0, 7));
  const [y, m] = ym.split("-").map(Number);
  const month = o.jobs.filter((j) => j.start_date.slice(0, 7) === ym);
  const done = month.filter((j) => j.status === "done");
  const labor = done.reduce((n, j) => n + (j.labor_price ?? 0), 0);
  const transport = done.reduce((n, j) => n + (j.transport_price ?? 0), 0);
  const revenue = done.reduce((n, j) => n + jobTotal(j), 0);
  const sources = (Object.keys(SOURCE_LABEL) as JobSource[])
    .map((s) => ({ source: s, count: month.filter((j) => j.source === s).length }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <section aria-labelledby="report-heading" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="report-heading" className="display text-4xl">
          Отчет за месеца
        </h2>
        {o.pro && (
          <div className="flex items-center gap-1">
            <button type="button" className={`${act} btn-ghost`} aria-label="Предишен месец" onClick={() => setYm(shiftMonth(ym, -1))}>
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <span className="min-w-36 text-center text-lg font-extrabold capitalize">
              {MONTHS[m - 1]} {y}
            </span>
            <button type="button" className={`${act} btn-ghost`} aria-label="Следващ месец" onClick={() => setYm(shiftMonth(ym, 1))}>
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>
        )}
      </div>

      {!o.pro ? (
        <LockNote look={look}>Отчетът (колко поръчки, колко пари, откъде идват клиентите) е в Pro.</LockNote>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            {[
              ["Поръчки", month.length],
              ["Свършени", done.length],
              ["Приходи", formatEur(revenue)],
              ["От тях труд", formatEur(labor)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[6px] bg-surface p-4">
                <dt className="text-sm text-ink-3">{label}</dt>
                <dd className="numerals mt-1 text-3xl leading-none">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm text-ink-3">
            Приходите се броят само за свършените поръчки: труд {formatEur(labor)}, транспорт {formatEur(transport)}, материали, които си осигурил ти,{" "}
            {formatEur(revenue - labor - transport)}.
          </p>
          <div>
            <h3 className="font-extrabold">Откъде идва работата</h3>
            {sources.length === 0 ? (
              <p className="mt-1 text-ink-3">Няма поръчки този месец.</p>
            ) : (
              <ul className="mt-2 grid max-w-xl gap-1.5">
                {sources.map((s) => (
                  <li key={s.source} className="flex items-center gap-3">
                    <span className="w-32 shrink-0">{SOURCE_LABEL[s.source]}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                      <span className="block h-full rounded-full bg-ink" style={{ width: `${(s.count / month.length) * 100}%` }} />
                    </span>
                    <span className="numerals w-6 text-right text-lg">{s.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
