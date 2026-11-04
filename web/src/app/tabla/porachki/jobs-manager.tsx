"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check, Lock, Pencil, Plus, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatEur } from "@/lib/format";
import { toMoney } from "@/lib/validation";
import { hasMoney, jobTotal, jobWhen, SOURCE_LABEL, type Client, type Job, type JobSource, type JobStatus } from "@/lib/jobs";
import { EmptyState } from "@/components/bits";
import { useConfirm } from "@/components/confirm-dialog";
import { DateField, TimeField } from "@/components/date-time-fields";

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
}: {
  userId: string;
  initialJobs: Job[];
  initialClients: Client[];
  today: string;
  proDetails: boolean;
  proClients: boolean;
}) {
  const supabase = createClient();
  const { confirm, dialog } = useConfirm();
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

  async function remove(j: Job) {
    const ok = await confirm({ title: `Да изтрия ли „${j.title}“?`, message: "Часовете ѝ ще се освободят в календара.", confirmLabel: "Изтрий", danger: true });
    if (!ok) return;
    start(async () => {
      const { error: e } = await supabase.from("jobs").delete().eq("id", j.id);
      if (e) return void toast.error("Не успяхме да изтрием поръчката.");
      toast.success("Поръчката е изтрита.");
      await reload();
    });
  }

  const upcoming = jobs.filter((j) => j.status === "planned" && j.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const overdue = jobs.filter((j) => j.status === "planned" && j.end_date < today);
  const history = jobs.filter((j) => j.status !== "planned");

  const Row = ({ j }: { j: Job }) => (
    <li className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-line py-3">
      <div className="min-w-0 flex-1">
        <p className={`font-bold ${j.status === "cancelled" ? "line-through opacity-60" : ""}`}>{j.title}</p>
        <p className="text-sm text-ink-2 first-letter:uppercase">{jobWhen(j)}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-3">
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-bold text-ink-2">{SOURCE_LABEL[j.source]}</span>
          {j.client_id && clientName.get(j.client_id) && <span>{clientName.get(j.client_id)}</span>}
          {j.note && <span className="truncate">{j.note}</span>}
        </p>
      </div>
      {hasMoney(j) && <p className="numerals text-2xl">{formatEur(jobTotal(j))}</p>}
      <div className="flex flex-wrap gap-1">
        {j.status === "planned" ? (
          <>
            <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => setStatus(j, "done")}>
              <Check className="size-4" aria-hidden /> Свършена
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setStatus(j, "cancelled")}>
              Отмени
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => setStatus(j, "planned")}>
              <Undo2 className="size-4" aria-hidden /> Върни
            </button>
          </>
        )}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(j)} aria-label={`Редактирай ${j.title}`}>
          <Pencil className="size-4" aria-hidden />
        </button>
        <button type="button" className="btn btn-ghost btn-sm text-danger" disabled={pending} onClick={() => remove(j)} aria-label={`Изтрий ${j.title}`}>
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  );

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <section aria-label="Поръчки" className="grid gap-6">
      {editing === null ? (
        <div>
          <button type="button" className="btn btn-primary btn-lg" onClick={openNew}>
            <Plus className="size-5" aria-hidden /> Нова поръчка
          </button>
        </div>
      ) : (
        <form onSubmit={save} className="grid gap-4 rounded-[10px] border-[1.5px] border-ink bg-surface p-5" noValidate>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-extrabold">{editing === "new" ? "Нова поръчка" : "Редакция на поръчка"}</h2>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)} aria-label="Затвори">
              <X className="size-5" aria-hidden />
            </button>
          </div>

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
              <DateField id="j-from" value={form.from} onChange={(v) => set("from", v)} />
            </div>
            <div>
              <label htmlFor="j-to" className="label">
                До ден <span className="font-normal text-ink-3">(ако е за няколко дни)</span>
              </label>
              <DateField id="j-to" min={form.from} value={form.to} onChange={(v) => set("to", v)} />
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
                    {x.from && x.key !== "custom" && <span className="text-xs font-medium opacity-75">{x.from.slice(0, 2)}–{x.to!.slice(0, 2)}</span>}
                  </button>
                ))}
              </div>
              {form.preset === "custom" && (
                <div className="mt-3 grid max-w-sm grid-cols-2 gap-2">
                  <TimeField ariaLabel="От" value={form.timeFrom} onChange={(v) => set("timeFrom", v)} />
                  <TimeField ariaLabel="До" value={form.timeTo} onChange={(v) => set("timeTo", v)} />
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
            <div className="flex items-start gap-3 rounded-[8px] border border-dashed border-line-strong p-4">
              <Lock className="mt-0.5 size-5 shrink-0" aria-hidden />
              <p className="text-sm text-ink-2">
                Клиентска карта, материали, транспорт и цена на поръчката са в Pro.{" "}
                <Link href="/tabla/plan" className="link font-bold">
                  Виж плановете
                </Link>
              </p>
            </div>
          ) : (
            <div className="grid gap-4 rounded-[8px] bg-surface-2 p-4">
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

              <div className="grid gap-3 sm:grid-cols-2">
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
                  <div className="grid gap-2">
                    {form.materials.map((m) => (
                      <div key={m.key} className="grid grid-cols-[minmax(0,1fr)_5rem_6rem_auto] gap-2">
                        <input
                          className="field"
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
                        <button type="button" className="btn btn-ghost btn-sm" aria-label="Премахни реда" onClick={() => set("materials", form.materials.filter((x) => x.key !== m.key))}>
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm justify-self-start"
                      onClick={() => set("materials", [...form.materials, { key: ++rowKey, name: "", qty: "", amount: "" }])}
                    >
                      <Plus className="size-4" aria-hidden /> Добави материал
                    </button>
                  </div>
                )}
              </fieldset>

              <p className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <span className="font-bold">Общо за теб</span>
                <span className="numerals text-3xl">{formatEur(total)}</span>
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
        </form>
      )}

      {jobs.length === 0 && editing === null && (
        <EmptyState title="Още нямаш поръчки">
          Когато някой ти се обади или те препоръчат, натисни „Нова поръчка“. Така календарът ти остава верен и ти не
          забравяш нищо.
        </EmptyState>
      )}

      {upcoming.length > 0 && (
        <div>
          <h2 className="display text-3xl">Предстоящи</h2>
          <ul className="mt-2 grid border-t-[1.5px] border-ink">
            {upcoming.map((j) => (
              <Row key={j.id} j={j} />
            ))}
          </ul>
        </div>
      )}
      {overdue.length > 0 && (
        <div>
          <h2 className="display text-3xl">Минали, още неотбелязани</h2>
          <p className="text-sm text-ink-3">Отбележи ги като свършени или ги отмени.</p>
          <ul className="mt-2 grid border-t-[1.5px] border-ink">
            {overdue.map((j) => (
              <Row key={j.id} j={j} />
            ))}
          </ul>
        </div>
      )}
      {history.length > 0 && (
        <div>
          <h2 className="display text-3xl">Свършени и отменени</h2>
          <ul className="mt-2 grid border-t-[1.5px] border-ink">
            {history.map((j) => (
              <Row key={j.id} j={j} />
            ))}
          </ul>
        </div>
      )}
      {dialog}
    </section>
  );
}
