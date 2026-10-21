"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { BellRing, Phone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatDate, timeAgo } from "@/lib/format";
import { ClientPhotos } from "./client-photos";

export const STATUS_LABEL = {
  new: "Нова заявка",
  inspection: "Оглед",
  offer: "Оферта",
  agreed: "Договорена",
  done: "Свършена",
} as const;
type Status = keyof typeof STATUS_LABEL;
type Filter = Status | "all" | "due";

export type NotebookClient = {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  status: Status;
  remind_at: string | null;
  remind_note: string | null;
  yearly_check: boolean;
};
export type NotebookNote = { id: string; client_id: string; body: string; created_at: string };
type LastJob = { title: string; end_date: string; count: number };

const COLUMNS = "id, name, phone, address, status, remind_at, remind_note, yearly_check";

export function ClientNotebook({
  today,
  userId,
  initialClients,
  initialNotes,
  lastJob,
}: {
  today: string;
  userId: string;
  initialClients: NotebookClient[];
  initialNotes: NotebookNote[];
  lastJob: Record<string, LastJob>;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [clients, setClients] = useState(initialClients);
  const [notes, setNotes] = useState(initialNotes);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", phone: "", address: "" });
  const [noteText, setNoteText] = useState("");

  const due = useMemo(() => (c: NotebookClient) => Boolean(c.remind_at && c.remind_at <= today), [today]);
  const sorted = useMemo(
    () =>
      [...clients]
        .filter((c) => (filter === "all" ? true : filter === "due" ? due(c) : c.status === filter))
        .sort((a, b) => Number(due(b)) - Number(due(a)) || a.name.localeCompare(b.name, "bg")),
    [clients, filter, due],
  );
  const dueCount = clients.filter(due).length;

  function patch(id: string, change: Partial<NotebookClient>) {
    const before = clients;
    setClients((xs) => xs.map((c) => (c.id === id ? { ...c, ...change } : c)));
    start(async () => {
      const { error } = await supabase.from("craftsman_clients").update(change).eq("id", id);
      if (error) {
        setClients(before);
        toast.error("Не успяхме да запишем промяната.");
      }
    });
  }

  function addClient(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.name.trim()) return void toast.error("Напиши име.");
    start(async () => {
      const { data, error } = await supabase
        .from("craftsman_clients")
        .insert({ craftsman_id: userId, name: draft.name.trim(), phone: draft.phone.trim() || null, address: draft.address.trim() || null })
        .select(COLUMNS)
        .single();
      if (error || !data) return void toast.error(error?.message || "Клиентът не беше добавен.");
      setClients((xs) => [...xs, data as NotebookClient]);
      setDraft({ name: "", phone: "", address: "" });
      setAdding(false);
      setOpenId(data.id);
    });
  }

  function addNote(clientId: string) {
    const body = noteText.trim();
    if (!body) return;
    start(async () => {
      const { data, error } = await supabase
        .from("client_notes")
        .insert({ client_id: clientId, craftsman_id: userId, body })
        .select("id, client_id, body, created_at")
        .single();
      if (error || !data) return void toast.error(error?.message || "Бележката не беше записана.");
      setNotes((xs) => [data as NotebookNote, ...xs]);
      setNoteText("");
    });
  }

  function removeNote(id: string) {
    start(async () => {
      const { error } = await supabase.from("client_notes").delete().eq("id", id);
      if (error) return void toast.error("Не успяхме да изтрием.");
      setNotes((xs) => xs.filter((n) => n.id !== id));
    });
  }

  function removeClient(c: NotebookClient) {
    if (!window.confirm(`Да изтрием ли „${c.name}“ и бележките към него? Поръчките остават.`)) return;
    start(async () => {
      const { error } = await supabase.from("craftsman_clients").delete().eq("id", c.id);
      if (error) return void toast.error("Не успяхме да изтрием.");
      setClients((xs) => xs.filter((x) => x.id !== c.id));
      router.refresh();
    });
  }

  const chips: [Filter, string][] = [
    ["all", `Всички (${clients.length})`],
    ...(dueCount ? ([["due", `За обаждане (${dueCount})`]] as [Filter, string][]) : []),
    ...(Object.entries(STATUS_LABEL) as [Status, string][]),
  ];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-2">
        {chips.map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            aria-pressed={filter === k}
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${filter === k ? "border-ink bg-ink text-white" : "border-line-strong bg-surface hover:bg-surface-2"}`}
          >
            {label}
          </button>
        ))}
        <button type="button" className="btn btn-primary btn-sm ml-auto" onClick={() => setAdding((v) => !v)}>
          <Plus className="size-4" aria-hidden /> Нов клиент
        </button>
      </div>

      {adding && (
        <form onSubmit={addClient} className="grid gap-3 rounded-[10px] border border-line bg-surface p-4 sm:grid-cols-3">
          <input className="field" placeholder="Име" aria-label="Име" maxLength={120} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input className="field" placeholder="Телефон" aria-label="Телефон" inputMode="tel" maxLength={40} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          <input className="field" placeholder="Адрес" aria-label="Адрес" maxLength={200} value={draft.address} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
          <div className="flex gap-2 sm:col-span-3">
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              Добави
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>
              Отказ
            </button>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="text-ink-2">
          {clients.length === 0 ? "Още няма клиенти. Добави първия или запиши поръчка с клиент." : "Няма клиенти в този филтър."}
        </p>
      ) : (
        <ul className="grid gap-2">
          {sorted.map((c) => {
            const open = openId === c.id;
            const job = lastJob[c.id];
            const mine = notes.filter((n) => n.client_id === c.id);
            return (
              <li key={c.id} className={`rounded-[10px] border bg-surface ${due(c) ? "border-ink" : "border-line"}`}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 p-3 text-left"
                  onClick={() => {
                    setOpenId(open ? null : c.id);
                    setNoteText("");
                  }}
                  aria-expanded={open}
                >
                  <span className="font-extrabold">{c.name}</span>
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs font-bold text-ink-2">{STATUS_LABEL[c.status]}</span>
                  {due(c) && (
                    <span className="inline-flex items-center gap-1 rounded bg-rule px-1.5 py-0.5 text-xs font-bold">
                      <BellRing className="size-3.5" aria-hidden /> {c.remind_note || "Обади се"} · {formatDate(c.remind_at!)}
                    </span>
                  )}
                  {job && (
                    <span className="ml-auto text-sm text-ink-3">
                      {job.count} {job.count === 1 ? "работа" : "работи"}, последна {formatDate(job.end_date)}
                    </span>
                  )}
                </button>

                {open && (
                  <div className="grid gap-4 border-t border-line p-3">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
                      {c.phone && (
                        <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-1 font-semibold hover:underline">
                          <Phone className="size-4" aria-hidden /> {c.phone}
                        </a>
                      )}
                      {c.address && <span>{c.address}</span>}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <label className="label" htmlFor={`st-${c.id}`}>
                          Етап
                        </label>
                        <select id={`st-${c.id}`} className="field" value={c.status} onChange={(e) => patch(c.id, { status: e.target.value as Status })}>
                          {(Object.entries(STATUS_LABEL) as [Status, string][]).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="label" htmlFor={`ra-${c.id}`}>
                          Напомни ми на
                        </label>
                        <input
                          id={`ra-${c.id}`}
                          type="date"
                          className="field"
                          value={c.remind_at ?? ""}
                          onChange={(e) => patch(c.id, e.target.value ? { remind_at: e.target.value } : { remind_at: null, remind_note: null })}
                        />
                      </div>
                      <div>
                        <label className="label" htmlFor={`rn-${c.id}`}>
                          За какво
                        </label>
                        <input
                          id={`rn-${c.id}`}
                          className="field"
                          maxLength={200}
                          defaultValue={c.remind_note ?? ""}
                          placeholder="напр. да се обадя за офертата"
                          disabled={!c.remind_at}
                          onBlur={(e) => e.target.value.trim() !== (c.remind_note ?? "") && patch(c.id, { remind_note: e.target.value.trim() || null })}
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="check" checked={c.yearly_check} onChange={(e) => patch(c.id, { yearly_check: e.target.checked })} />
                      Годишен преглед: напомни ми година след последната свършена работа
                    </label>

                    <ClientPhotos clientId={c.id} userId={userId} craftsmanId={userId} />

                    <div>
                      <h3 className="font-extrabold">Бележки</h3>
                      <div className="mt-2 flex gap-2">
                        <input
                          className="field min-w-0 flex-1"
                          maxLength={1000}
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Какво сте се разбрали, домофон, ключ при съседа…"
                          aria-label="Нова бележка"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addNote(c.id);
                            }
                          }}
                        />
                        <button type="button" className="btn btn-outline btn-sm" disabled={pending || !noteText.trim()} onClick={() => addNote(c.id)}>
                          Запиши
                        </button>
                      </div>
                      {mine.length > 0 && (
                        <ul className="mt-2 grid">
                          {mine.map((n) => (
                            <li key={n.id} className="flex items-start gap-3 border-b border-line py-2">
                              <p className="flex-1 whitespace-pre-wrap">{n.body}</p>
                              <span className="shrink-0 text-xs text-ink-3">{timeAgo(n.created_at)}</span>
                              <button type="button" className="text-danger" onClick={() => removeNote(n.id)} aria-label="Изтрий бележката">
                                <Trash2 className="size-4" aria-hidden />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => removeClient(c)}>
                        <Trash2 className="size-4" aria-hidden /> Изтрий клиента
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
