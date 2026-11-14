"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, ChevronRight, Lock, MessageSquare, Pencil, Plus, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { diffDays, formatDate, formatEur, isoWeekday, MONTHS, MONTHS_SHORT, parseISO, WEEKDAYS_SHORT } from "@/lib/format";
import { toMoney } from "@/lib/validation";
import { hasMoney, jobTotal, SOURCE_LABEL, type Client, type Job, type JobSource, type JobStatus, type OrderBooking } from "@/lib/jobs";

/**
 * Boxes without frames: a light panel under a yellow band that carries the title in the condensed face;
 * the quieter part inside it is one step back, on the paper.
 */
const look = {
  shell: "grid overflow-hidden rounded-[10px] bg-surface",
  head: "flex items-center justify-between gap-3 bg-rule px-5 py-2.5",
  title: "display text-3xl",
  body: "grid gap-4 p-5",
  panel: "rounded-[8px] bg-paper p-4",
  sum: "flex items-baseline justify-between gap-3 rounded-[6px] bg-surface px-3 py-2.5",
};

/** A group without a line over it: its name in the condensed face, then the rows. */
const group = "display mb-2 text-[1.7rem]";

const NO_MARKER = "list-none [&::-webkit-details-marker]:hidden";

/** Row buttons: 36px with a pointer, 44px under a thumb. */
const act = "btn btn-sm max-sm:min-h-11";

const BUCKETS = ["Днес", "Утре", "До една седмица", "По-късно"] as const;
const bucket = (iso: string, today: string) => {
  const n = diffDays(today, iso);
  return n <= 0 ? 0 : n === 1 ? 1 : n <= 7 ? 2 : 3;
};

type Item = { kind: "job"; key: string; date: string; job: Job } | { kind: "chat"; key: string; date: string; booking: OrderBooking };

const later = (a: string, b: string) => (a > b ? a : b);
const startOf = (i: Item) => (i.kind === "job" ? i.job.start_time : i.booking.start_time) ?? "00:00";
const cap = (t: string) => t.charAt(0).toLocaleUpperCase("bg") + t.slice(1);

/** Past jobs by month, newest first, with what the finished ones brought in. */
function byMonth(history: Job[]) {
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

/** "09:00-11:00", "цял ден", "до 26 ноември, цели дни" */
const jobHours = (j: Job) =>
  j.end_date !== j.start_date ? `до ${formatDate(j.end_date)}, цели дни` : j.start_time ? `${j.start_time.slice(0, 5)}-${j.end_time!.slice(0, 5)}` : "цял ден";

const bookingHours = (b: OrderBooking) =>
  b.end_date ? `до ${formatDate(b.end_date)}, цели дни` : b.start_time ? `${b.start_time.slice(0, 5)}-${b.end_time!.slice(0, 5)}` : "цял ден";

const bookingTitle = (b: OrderBooking) => `${b.kind === "inspection" ? "Оглед" : "Работа"} при ${b.partner_name}`;

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

export function JobsManager({
  userId,
  initialJobs,
  initialClients,
  today,
  proDetails,
  proClients,
  bookings,
}: {
  userId: string;
  initialJobs: Job[];
  initialClients: Client[];
  today: string;
  proDetails: boolean;
  proClients: boolean;
  bookings: OrderBooking[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [jobs, setJobs] = useState(initialJobs);
  const [clients, setClients] = useState(initialClients);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [pending, start] = useTransition();
  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.name])), [clients]);
  const blank = (): Form => ({
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
  });
  const [form, setForm] = useState<Form>(blank);
  const [error, setError] = useState<string | null>(null);

  function openNew() {
    setForm(blank());
    setError(null);
    setEditing("new");
  }

  function openEdit(j: Job) {
    const preset =
      j.start_time == null
        ? "day"
        : (PRESETS.find((p) => p.from === j.start_time!.slice(0, 5) && p.to === j.end_time!.slice(0, 5) && p.key !== "custom")?.key ?? "custom");
    setForm({
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
    });
    setError(null);
    setEditing(j.id);
  }

  const multiDay = form.to !== "" && form.to > form.from;
  const total = useMemo(() => {
    const mats = form.byClient ? 0 : form.materials.reduce((n, m) => n + (toMoney(m.amount) ?? 0), 0);
    return (toMoney(form.labor) ?? 0) + (toMoney(form.transport) ?? 0) + mats;
  }, [form.byClient, form.materials, form.labor, form.transport]);

  async function reload() {
    const { data } = await supabase
      .from("jobs")
      .select(
        "id, title, source, start_date, end_date, start_time, end_time, status, note, materials_by_client, labor_price, transport_price, client_id, done_at, job_materials(id, name, qty, amount)",
      )
      .eq("craftsman_id", userId)
      .order("start_date", { ascending: false })
      .limit(300);
    setJobs(
      (data ?? []).map((j) => {
        const { job_materials, ...rest } = j as typeof j & { job_materials: Job["materials"] };
        return {
          ...rest,
          labor_price: rest.labor_price != null ? Number(rest.labor_price) : null,
          transport_price: rest.transport_price != null ? Number(rest.transport_price) : null,
          materials: (job_materials ?? []).map((m) => ({ ...m, amount: Number(m.amount) })),
        } as Job;
      }),
    );
    const { data: cl } = await supabase.from("craftsman_clients").select("id, name, phone, address, note").eq("craftsman_id", userId).order("name");
    if (cl) setClients(cl as Client[]);
    router.refresh();
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const title = form.title.trim();
    if (!title) return setError("Напишете каква е работата.");
    if (!form.from) return setError("Изберете ден.");
    if (form.to && form.to < form.from) return setError("Крайният ден трябва да е след първия.");
    const p = PRESETS.find((x) => x.key === form.preset)!;
    const st = multiDay || form.preset === "day" ? null : form.preset === "custom" ? form.timeFrom : p.from;
    const en = multiDay || form.preset === "day" ? null : form.preset === "custom" ? form.timeTo : p.to;
    if (st && en && en <= st) return setError("Краят трябва да е след началото.");
    for (const f of [form.labor, form.transport, ...form.materials.map((m) => m.amount)]) {
      const v = toMoney(f);
      if (f.trim() !== "" && (v == null || Number.isNaN(v) || v < 0)) return setError("Сумите трябва да са числа, напр. 25 или 12,50.");
    }
    if (form.clientMode === "new" && !form.cName.trim()) return setError("Напишете името на клиента.");

    start(async () => {
      try {
        let clientId: string | null = form.clientMode === "existing" && form.clientId ? form.clientId : null;
        if (proClients && form.clientMode === "new") {
          const { data, error: ce } = await supabase
            .from("craftsman_clients")
            .insert({ craftsman_id: userId, name: form.cName.trim(), phone: form.cPhone.trim() || null, address: form.cAddress.trim() || null })
            .select("id")
            .single();
          if (ce || !data) throw new Error(ce?.message || "Клиентът не беше записан.");
          clientId = data.id;
        }
        const row = {
          title,
          source: form.source,
          start_date: form.from,
          end_date: multiDay ? form.to : form.from,
          start_time: st,
          end_time: en,
          note: form.note.trim() || null,
          materials_by_client: form.byClient,
          ...(proDetails || proClients
            ? {
                client_id: clientId,
                labor_price: toMoney(form.labor),
                transport_price: toMoney(form.transport),
              }
            : {}),
        };
        let jobId = editing as string;
        if (editing === "new") {
          const { data, error: je } = await supabase.from("jobs").insert({ ...row, craftsman_id: userId }).select("id").single();
          if (je || !data) throw new Error(je?.message || "Поръчката не беше записана.");
          jobId = data.id;
        } else {
          const { error: je } = await supabase.from("jobs").update(row).eq("id", editing!);
          if (je) throw new Error(je.message);
        }
        if (proDetails) {
          await supabase.from("job_materials").delete().eq("job_id", jobId);
          const mats = form.materials
            .filter((m) => m.name.trim())
            .map((m) => ({ job_id: jobId, craftsman_id: userId, name: m.name.trim(), qty: m.qty.trim() || null, amount: toMoney(m.amount) ?? 0 }));
          if (mats.length) {
            const { error: me } = await supabase.from("job_materials").insert(mats);
            if (me) throw new Error(me.message);
          }
        }
        toast.success(editing === "new" ? "Поръчката е записана и часовете са заети в календара." : "Поръчката е обновена.");
        setEditing(null);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не успяхме да запишем поръчката.");
      }
    });
  }

  function setStatus(j: Job, status: JobStatus) {
    start(async () => {
      const { error: e } = await supabase.from("jobs").update({ status }).eq("id", j.id);
      if (e) return void toast.error("Не успяхме да променим поръчката.");
      toast.success(status === "done" ? "Отбелязана като свършена." : status === "cancelled" ? "Поръчката е отменена и часовете са свободни." : "Поръчката е върната в предстоящи.");
      await reload();
    });
  }

  function remove(j: Job) {
    if (!window.confirm(`Да изтрия ли „${j.title}“? Часовете ѝ ще се освободят в календара.`)) return;
    start(async () => {
      const { error: e } = await supabase.from("jobs").delete().eq("id", j.id);
      if (e) return void toast.error("Не успяхме да изтрием поръчката.");
      toast.success("Поръчката е изтрита.");
      await reload();
    });
  }

  const upcoming: Item[] = [
    ...jobs
      .filter((j) => j.status === "planned" && j.end_date >= today)
      .map((j): Item => ({ kind: "job", key: j.id, date: later(j.start_date, today), job: j })),
    ...bookings.map((b): Item => ({ kind: "chat", key: b.id, date: b.booking_date, booking: b })),
  ].sort((a, b) => a.date.localeCompare(b.date) || startOf(a).localeCompare(startOf(b)));
  const overdue = jobs.filter((j) => j.status === "planned" && j.end_date < today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const history = jobs.filter((j) => j.status !== "planned").sort((a, b) => b.start_date.localeCompare(a.start_date));
  const groups = BUCKETS.map((name, i) => ({ name, i, items: upcoming.filter((x) => bucket(x.date, today) === i) })).filter((g) => g.items.length > 0);
  const months = byMonth(history);
  const acts: RowActions = { today, pending, clientName: (j) => (j.client_id ? clientName.get(j.client_id) : undefined), setStatus, openEdit, remove };

  const box = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (editing === null) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.current?.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
    box.current?.querySelector<HTMLInputElement>("#j-title")?.focus({ preventScroll: true });
  }, [editing]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <section aria-label="Поръчки" className="grid gap-10">
      {editing === null ? (
        <div>
          <button type="button" className="btn btn-primary btn-lg max-sm:w-full" onClick={openNew}>
            <Plus className="size-5" aria-hidden /> Нова поръчка
          </button>
        </div>
      ) : (
        <form ref={box} onSubmit={save} className={look.shell} noValidate aria-labelledby="j-heading">
          <div className={look.head}>
            <h2 id="j-heading" className={look.title}>
              {editing === "new" ? "Нова поръчка" : "Редакция на поръчка"}
            </h2>
            <button type="button" className="btn btn-ghost btn-sm -mr-2 max-sm:min-h-11 max-sm:min-w-11" onClick={() => setEditing(null)} aria-label="Затвори">
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
            <p className="hint -mt-2">Всички дни от {form.from.slice(8)}.{form.from.slice(5, 7)} до {form.to.slice(8)}.{form.to.slice(5, 7)} стават заети цели.</p>
          ) : (
            <fieldset className="-mt-1">
              <legend className="label">Час</legend>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((x) => (
                  <button key={x.key} type="button" className="chip" aria-pressed={form.preset === x.key} onClick={() => set("preset", x.key)}>
                    {x.label}
                    {x.from && x.key !== "custom" && <span className="text-xs font-medium opacity-75">{x.from.slice(0, 2)}-{x.to!.slice(0, 2)}</span>}
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

          {!proDetails ? (
            <div className={`flex items-start gap-3 ${look.panel}`}>
              <Lock className="mt-0.5 size-5 shrink-0" aria-hidden />
              <p className="text-sm text-ink-2">
                Клиентска карта, материали, транспорт и цена на поръчката са в Pro.{" "}
                <Link href="/tabla/plan" className="link font-bold">
                  Виж плановете
                </Link>
              </p>
            </div>
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
                      disabled={k === "existing" && clients.length === 0}
                      onClick={() => set("clientMode", k)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {form.clientMode === "existing" && (
                  <select className="field mt-3 max-w-md" aria-label="Клиент" value={form.clientId} onChange={(e) => set("clientId", e.target.value)}>
                    <option value="">Избери клиент</option>
                    {clients.map((c) => (
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
                          onChange={(e) => set("materials", form.materials.map((x) => (x.key === m.key ? { ...x, name: e.target.value } : x)))}
                        />
                        <input
                          className="field"
                          placeholder="бр."
                          aria-label="Количество"
                          maxLength={40}
                          value={m.qty}
                          onChange={(e) => set("materials", form.materials.map((x) => (x.key === m.key ? { ...x, qty: e.target.value } : x)))}
                        />
                        <input
                          className="field"
                          placeholder="€"
                          aria-label="Сума"
                          inputMode="decimal"
                          value={m.amount}
                          onChange={(e) => set("materials", form.materials.map((x) => (x.key === m.key ? { ...x, amount: e.target.value } : x)))}
                        />
                        <button type="button" className="btn btn-ghost btn-sm min-h-[2.875rem]" aria-label="Премахни реда" onClick={() => set("materials", form.materials.filter((x) => x.key !== m.key))}>
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
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Записваме…" : editing === "new" ? "Запиши поръчката" : "Запази"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
              Откажи
            </button>
          </div>
          </div>
        </form>
      )}

      {overdue.length > 0 && (
        <section aria-labelledby="dni-overdue" className="rounded-[10px] bg-rule-soft p-3 sm:p-4">
          <h2 id="dni-overdue" className="px-1 text-xl font-extrabold">
            {overdue.length === 1 ? "1 поръчка е минала и чака отметка" : `${overdue.length} поръчки са минали и чакат отметка`}
          </h2>
          <p className="px-1 text-sm text-ink-2">Отбележи ги като свършени или ги отмени.</p>
          <ul className="mt-3 grid gap-1">
            {overdue.map((j) => (
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
                  <button type="button" className={`${act} btn-primary max-sm:flex-1`} disabled={pending} onClick={() => setStatus(j, "done")}>
                    <Check className="size-4" aria-hidden /> Свършена
                  </button>
                  <button type="button" className={`${act} btn-outline max-sm:flex-1`} disabled={pending} onClick={() => setStatus(j, "cancelled")}>
                    Отмени
                  </button>
                  <button type="button" className={`${act} btn-ghost`} onClick={() => openEdit(j)} aria-label={`Редактирай ${j.title}`}>
                    <Pencil className="size-4" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Предстоящи" className="grid gap-7">
        {groups.length === 0 && (
          <p className="rounded-[6px] bg-surface px-3 py-4 text-ink-2">Няма предстояща работа. Когато някой ти се обади, натисни „Нова поръчка“.</p>
        )}
        {groups.map((g) => (
          <div key={g.name}>
            <h2 className={group}>{g.name}</h2>
            <ul className="grid gap-1">
              {g.items.map((x) => (
                <li key={x.key}>
                  {x.kind === "job" ? (
                    <JobRow a={acts} j={x.job} date={x.date} under={g.i === 3 ? "month" : "weekday"} />
                  ) : (
                    <ChatRow b={x.booking} date={x.date} today={today} under={g.i === 3 ? "month" : "weekday"} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {history.length > 0 && (
        <details className="group/past">
          <summary className={`flex min-h-11 cursor-pointer items-center gap-2.5 ${NO_MARKER}`}>
            <h2 className="display text-3xl">Свършени и отменени</h2>
            <span className="numerals text-2xl leading-none text-ink-3">{history.length}</span>
            <ChevronDown className="size-5 text-ink-3 transition-transform duration-200 group-open/past:rotate-180 motion-reduce:transition-none" aria-hidden />
          </summary>
          <div className="mt-3 grid gap-7">
            {months.map((m) => (
              <div key={m.ym}>
                <h3 className={`${group} flex items-baseline justify-between gap-3`}>
                  <span>{m.label}</span>
                  {m.done > 0 && (
                    <span className="font-sans text-sm font-bold tracking-normal text-ink-3">
                      {m.done === 1 ? "1 свършена" : `${m.done} свършени`} · <span className="numerals text-lg text-ink">{formatEur(m.total)}</span>
                    </span>
                  )}
                </h3>
                <ul className="grid gap-1">
                  {m.jobs.map((j) => (
                    <li key={j.id}>
                      <JobRow a={acts} j={j} date={j.start_date} under="weekday" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

type RowActions = {
  today: string;
  pending: boolean;
  clientName: (j: Job) => string | undefined;
  setStatus: (j: Job, status: JobStatus) => void;
  openEdit: (j: Job) => void;
  remove: (j: Job) => void;
};

/** The day as it is printed on the row: a condensed numeral, red for today, with the weekday or the month under it. */
function DateBlock({ iso, today, under = "weekday", muted }: { iso: string; today: string; under?: "weekday" | "month"; muted?: boolean }) {
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

function ChatTag() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-[4px] bg-rule-soft px-1.5 py-0.5 text-xs font-bold text-ink">
      <MessageSquare className="size-3" aria-hidden /> от чата
    </span>
  );
}

/** The state of a chat visit, with the same words and colours as „Уговорки“ on the overview. */
function BookingState({ b, className = "" }: { b: OrderBooking; className?: string }) {
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

/** A job: closed it is the day, the work and the sum; opened it shows the note, the money and what can be done with it. */
function JobRow({ a, j, date, under }: { a: RowActions; j: Job; date: string; under: "weekday" | "month" }) {
  const client = a.clientName(j);
  const cancelled = j.status === "cancelled";
  const past = j.status !== "planned";
  const materials = j.materials_by_client ? 0 : j.materials.reduce((n, m) => n + m.amount, 0);
  return (
    <details name="dni-red" className={`group rounded-[6px] ${cancelled ? "bg-surface-2" : "bg-surface"}`}>
      <summary className={`flex min-h-16 cursor-pointer items-center gap-3 px-3 py-2.5 ${NO_MARKER}`}>
        <DateBlock iso={date} today={a.today} under={under} muted={past} />
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
        <ChevronDown className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
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
            <button type="button" className={`${act} btn-outline`} disabled={a.pending} onClick={() => a.setStatus(j, "planned")}>
              <Undo2 className="size-4" aria-hidden /> Върни в предстоящи
            </button>
          ) : (
            <>
              <button type="button" className={`${act} btn-outline`} disabled={a.pending} onClick={() => a.setStatus(j, "done")}>
                <Check className="size-4" aria-hidden /> Свършена
              </button>
              <button type="button" className={`${act} btn-ghost`} disabled={a.pending} onClick={() => a.setStatus(j, "cancelled")}>
                Отмени
              </button>
            </>
          )}
          <button type="button" className={`${act} btn-ghost`} onClick={() => a.openEdit(j)}>
            <Pencil className="size-4" aria-hidden /> Редактирай
          </button>
          <button type="button" className={`${act} btn-ghost text-danger`} disabled={a.pending} onClick={() => a.remove(j)}>
            <Trash2 className="size-4" aria-hidden /> Изтрий
          </button>
        </div>
      </div>
    </details>
  );
}

/** A visit agreed in the chat: the same row, but it is a link to the conversation and has no buttons. */
function ChatRow({ b, date, today, under }: { b: OrderBooking; date: string; today: string; under: "weekday" | "month" }) {
  return (
    <Link
      href={`/saobshtenia/${b.conversation_id}`}
      className="flex min-h-16 items-center gap-3 rounded-[6px] bg-surface px-3 py-2.5 transition-colors hover:bg-rule-soft motion-reduce:transition-none"
    >
      <DateBlock iso={date} today={today} under={under} />
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{bookingTitle(b)}</span>
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-ink-2">
          <ChatTag />
          <BookingState b={b} className="sm:hidden" />
          <span className="max-sm:basis-full">
            <span className="sr-only">{formatDate(date, true)}, </span>
            {bookingHours(b)}
            {b.note ? ` · ${b.note}` : ""}
          </span>
        </span>
      </span>
      <BookingState b={b} className="max-sm:hidden" />
      <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
    </Link>
  );
}
