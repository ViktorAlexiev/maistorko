"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatEur, todayISO } from "@/lib/format";
import { DateField } from "@/components/date-time-fields";

type Line = { key: number; name: string; amount: string; kind: "service" | "material" };
let lineKey = 0;
const newLine = (kind: Line["kind"] = "service"): Line => ({ key: ++lineKey, name: "", amount: "", kind });

export type CreatedOffer = { token: string; title: string; total: number };

/**
 * An offer written from inside the chat. It is saved like any offer (Pro), and the chat gets a message with a card
 * that opens the public offer page, where the client accepts with one tap.
 */
export function OfferSheet({
  open,
  onClose,
  craftsmanId,
  partnerName,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  craftsmanId: string;
  partnerName: string;
  onCreated: (offer: CreatedOffer) => Promise<void> | void;
}) {
  const supabase = createClient();
  const ref = useRef<HTMLDialogElement>(null);
  const [today] = useState(todayISO);
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [lines, setLines] = useState<Line[]>([newLine()]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const total = lines.reduce((s, l) => s + (Number(l.amount.replace(",", ".")) || 0), 0);
  const setLine = (key: number, patch: Partial<Line>) => setLines((xs) => xs.map((l) => (l.key === key ? { ...l, ...patch } : l)));

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
          craftsman_id: craftsmanId,
          title: title.trim(),
          client_name: partnerName,
          note: note.trim() || null,
          lines: clean,
          start_date: from || null,
          end_date: from && to && to > from ? to : null,
        })
        .select("token, total")
        .single();
      if (error || !data) return void toast.error(error?.message || "Офертата не беше записана.");
      await onCreated({ token: data.token, title: title.trim(), total: Number(data.total) });
      setTitle("");
      setNote("");
      setFrom("");
      setTo("");
      setLines([newLine()]);
      onClose();
    });
  }

  return (
    <dialog ref={ref} className="sheet" aria-labelledby="of-sheet-title" onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <form onSubmit={submit} className="safe-bottom grid max-h-[88dvh] gap-4 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="of-sheet-title" className="display text-4xl">
              Оферта
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              {partnerName.split(" ")[0]} получава карта с цената в този разговор и я приема с един клик. Не е фактура, а споделена цена и срок.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current?.close()} aria-label="Затвори">
            <X className="size-6" aria-hidden />
          </button>
        </div>

        <div>
          <label htmlFor="os-title" className="label">
            Каква работа?
          </label>
          <input id="os-title" className="field" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="напр. Смяна на батерия и сифон в банята" />
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
              <input className="field w-24" inputMode="decimal" value={l.amount} onChange={(e) => setLine(l.key, { amount: e.target.value })} placeholder="€" aria-label="Сума в евро" />
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

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="os-from" className="label">
              От ден <span className="font-normal text-ink-3">(по желание)</span>
            </label>
            <DateField id="os-from" min={today} value={from} onChange={setFrom} />
          </div>
          <div>
            <label htmlFor="os-to" className="label">
              До ден
            </label>
            <DateField id="os-to" min={from || today} value={to} onChange={setTo} disabled={!from} />
          </div>
        </div>

        <div>
          <label htmlFor="os-note" className="label">
            Бележка <span className="font-normal text-ink-3">(по желание)</span>
          </label>
          <textarea id="os-note" className="field" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Гаранция, условия, кога идваш…" />
        </div>

        <button type="submit" className="btn btn-primary" disabled={pending}>
          Прати офертата
        </button>
      </form>
    </dialog>
  );
}
