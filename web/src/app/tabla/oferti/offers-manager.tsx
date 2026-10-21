"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Copy, Plus, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatDate, formatEur } from "@/lib/format";

export type OfferRow = {
  id: string;
  token: string;
  title: string;
  client_name: string | null;
  total: number | string;
  start_date: string | null;
  end_date: string | null;
  status: "sent" | "accepted" | "declined";
  valid_until: string;
  viewed_at: string | null;
  responded_at: string | null;
  accepted_by: string | null;
  created_at: string;
};

type Line = { key: number; name: string; amount: string; kind: "service" | "material" };

let lineKey = 0;
const newLine = (kind: Line["kind"] = "service"): Line => ({ key: ++lineKey, name: "", amount: "", kind });

const linkFor = (token: string) => `${window.location.origin}/oferta/${token}`;

function statusLabel(o: OfferRow) {
  if (o.status === "accepted") return { text: `Приета${o.accepted_by ? ` от ${o.accepted_by}` : ""}`, cls: "bg-free-soft text-free" };
  if (o.status === "declined") return { text: "Отказана", cls: "bg-danger-soft text-danger" };
  if (new Date(o.valid_until) < new Date()) return { text: "Изтекла", cls: "bg-surface-2 text-ink-3" };
  return { text: o.viewed_at ? "Клиентът я е видял" : "Изпратена", cls: "bg-rule-soft text-ink" };
}

export function OffersManager({ initial, userId, today }: { initial: OfferRow[]; userId: string; today: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [note, setNote] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [created, setCreated] = useState<string | null>(null);

  const total = lines.reduce((s, l) => s + (Number(l.amount.replace(",", ".")) || 0), 0);
  const setLine = (key: number, patch: Partial<Line>) => setLines((xs) => xs.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function reset() {
    setTitle("");
    setClientName("");
    setNote("");
    setFrom("");
    setTo("");
    setLines([newLine()]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = lines
      .filter((l) => l.name.trim() || l.amount.trim())
      .map((l) => ({ name: l.name.trim(), kind: l.kind, amount: (Number(l.amount.replace(",", ".")) || 0).toFixed(2) }));
    if (!title.trim()) return void toast.error("Напиши за каква работа е офертата.");
    if (!clean.length || clean.some((l) => !l.name)) return void toast.error("Всеки ред има име и сума.");
    start(async () => {
      const { data, error } = await supabase
        .from("offers")
        .insert({
          craftsman_id: userId,
          title: title.trim(),
          client_name: clientName.trim() || null,
          note: note.trim() || null,
          lines: clean,
          start_date: from || null,
          end_date: from && to && to > from ? to : null,
        })
        .select("token")
        .single();
      if (error || !data) return void toast.error(error?.message || "Офертата не беше записана.");
      setCreated(linkFor(data.token));
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Линкът е копиран.");
    } catch {
      toast.error("Не успяхме да копираме. Маркирай линка и го копирай ръчно.");
    }
  }

  function remove(o: OfferRow) {
    if (!window.confirm(`Да изтрием ли офертата „${o.title}“? Линкът ще спре да работи.`)) return;
    start(async () => {
      const { error } = await supabase.from("offers").delete().eq("id", o.id);
      if (error) return void toast.error("Не успяхме да изтрием.");
      router.refresh();
    });
  }

  const shareText = (url: string) => `Здравейте! Ето офертата за работата: ${url}`;

  return (
    <div className="grid gap-6">
      {created && (
        <div className="rounded-[10px] bg-rule-soft p-4">
          <p className="font-bold">Офертата е готова. Изпрати този линк на клиента.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <input readOnly className="field min-w-0 flex-1 text-sm" value={created} aria-label="Линк към офертата" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => copy(created)}>
              <Copy className="size-4" aria-hidden /> Копирай
            </button>
            <a className="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer" href={`viber://forward?text=${encodeURIComponent(shareText(created))}`}>
              <Send className="size-4" aria-hidden /> Viber
            </a>
            <a className="btn btn-outline btn-sm" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(shareText(created))}`}>
              <Send className="size-4" aria-hidden /> WhatsApp
            </a>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreated(null)} aria-label="Скрий">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      )}

      {!open ? (
        <div>
          <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden /> Нова оферта
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-4 rounded-[10px] border border-line bg-surface p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="of-title" className="label">Каква работа?</label>
              <input id="of-title" className="field" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="напр. Смяна на батерия и сифон в банята" />
            </div>
            <div>
              <label htmlFor="of-client" className="label">Клиент <span className="font-normal text-ink-3">(по желание)</span></label>
              <input id="of-client" className="field" maxLength={120} value={clientName} onChange={(e) => setClientName(e.target.value)} />
            </div>
          </div>

          <fieldset className="grid gap-2">
            <legend className="label">Какво включва</legend>
            {lines.map((l) => (
              <div key={l.key} className="flex flex-wrap items-center gap-2">
                <select className="field w-auto min-w-0" value={l.kind} onChange={(e) => setLine(l.key, { kind: e.target.value as Line["kind"] })} aria-label="Вид ред">
                  <option value="service">Труд</option>
                  <option value="material">Материал</option>
                </select>
                <input className="field min-w-0 flex-1" maxLength={120} value={l.name} onChange={(e) => setLine(l.key, { name: e.target.value })} placeholder="Име" aria-label="Име на реда" />
                <input className="field w-28" inputMode="decimal" value={l.amount} onChange={(e) => setLine(l.key, { amount: e.target.value })} placeholder="Сума €" aria-label="Сума в евро" />
                {lines.length > 1 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLines((xs) => xs.filter((x) => x.key !== l.key))} aria-label="Махни реда">
                    <X className="size-4" aria-hidden />
                  </button>
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setLines((xs) => [...xs, newLine("service")])}>
                  <Plus className="size-4" aria-hidden /> Труд
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setLines((xs) => [...xs, newLine("material")])}>
                  <Plus className="size-4" aria-hidden /> Материал
                </button>
              </div>
              <p className="numerals text-2xl">Общо {formatEur(total)}</p>
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="of-from" className="label">От дата <span className="font-normal text-ink-3">(по желание)</span></label>
              <input id="of-from" type="date" className="field" min={today} value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label htmlFor="of-to" className="label">До дата <span className="font-normal text-ink-3">(ако е за няколко дни)</span></label>
              <input id="of-to" type="date" className="field" min={from || today} value={to} onChange={(e) => setTo(e.target.value)} disabled={!from} />
            </div>
          </div>
          <p className="-mt-2 text-sm text-ink-3">Ако посочиш дата, при приемане от клиента работата се записва в „Поръчки“ и календарът ти я брои за заета.</p>

          <div>
            <label htmlFor="of-note" className="label">Бележка <span className="font-normal text-ink-3">(по желание)</span></label>
            <textarea id="of-note" className="field" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Гаранция, условия, кога идваш…" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              Направи линк
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Отказ
            </button>
          </div>
        </form>
      )}

      <section aria-labelledby="offers-list">
        <h2 id="offers-list" className="display text-3xl">Изпратени оферти</h2>
        {initial.length === 0 ? (
          <p className="mt-2 text-ink-2">Още нямаш оферти.</p>
        ) : (
          <ul className="mt-3 grid border-t border-line">
            {initial.map((o) => {
              const st = statusLabel(o);
              return (
                <li key={o.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 border-b border-line py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{o.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-3">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${st.cls}`}>{st.text}</span>
                      {o.client_name && <span>{o.client_name}</span>}
                      {o.start_date && <span>{formatDate(o.start_date)}{o.end_date && o.end_date !== o.start_date ? ` – ${formatDate(o.end_date)}` : ""}</span>}
                    </p>
                  </div>
                  <p className="numerals text-2xl">{formatEur(Number(o.total))}</p>
                  <div className="flex gap-1">
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => copy(linkFor(o.token))}>
                      <Copy className="size-4" aria-hidden /> Линк
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm text-danger" disabled={pending} onClick={() => remove(o)} aria-label={`Изтрий ${o.title}`}>
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
