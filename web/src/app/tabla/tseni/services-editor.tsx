"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { fieldErrors, serviceSchema, toMoney, type FieldErrors } from "@/lib/validation";
import { servicePrice, UNIT_OPTIONS, type PriceKind, type PriceUnit } from "@/lib/format";
import { EmptyState } from "@/components/bits";

type Service = {
  id: string;
  name: string;
  description: string | null;
  price_kind: PriceKind;
  price: string;
  unit: PriceUnit;
  category_id: number | null;
  sort: number;
};

const blank = { name: "", kind: "fixed" as PriceKind, price: "", unit: "job" as PriceUnit, categoryId: "", description: "" };

export function ServicesEditor({
  userId,
  initial,
  categories,
}: {
  userId: string;
  initial: Service[];
  categories: { id: number; name: string }[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, start] = useTransition();
  // Checked categories that still have no price: offered first when adding a service
  const priced = new Set(items.map((x) => x.category_id).filter(Boolean));
  const unpriced = categories.filter((c) => !priced.has(c.id));
  const OTHER = "other";
  const [pick, setPick] = useState<string>(OTHER);

  function pickCategory(v: string) {
    if (v === pick) v = OTHER;
    setPick(v);
    const c = categories.find((x) => String(x.id) === v);
    setForm((f) => (c ? { ...f, name: c.name, categoryId: String(c.id) } : { ...f, name: "", categoryId: "" }));
  }

  function edit(s?: Service) {
    setErrors({});
    if (!s) {
      setPick(OTHER);
      setForm(blank);
      setEditing("new");
      return;
    }
    setForm({
      name: s.name,
      kind: s.price_kind,
      price: s.price,
      unit: s.unit,
      categoryId: s.category_id ? String(s.category_id) : "",
      description: s.description ?? "",
    });
    setEditing(s.id);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = serviceSchema.safeParse(form);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    const row = {
      name: parsed.data.name,
      price_kind: parsed.data.kind,
      price: parsed.data.kind === "quote" ? null : toMoney(parsed.data.price),
      unit: parsed.data.unit,
      category_id: parsed.data.categoryId ? Number(parsed.data.categoryId) : null,
      description: form.description.trim() || null,
    };
    start(async () => {
      if (editing === "new") {
        const { data, error } = await supabase
          .from("services")
          .insert({ ...row, craftsman_id: userId, sort: items.length })
          .select("id, name, description, price_kind, price, unit, category_id, sort")
          .single();
        if (error || !data) return void toast.error("Услугата не беше добавена.");
        setItems((xs) => [...xs, { ...data, price: data.price != null ? String(data.price) : "" } as Service]);
        toast.success("Услугата е добавена.");
      } else if (editing) {
        const { error } = await supabase.from("services").update(row).eq("id", editing);
        if (error) return void toast.error("Промените не бяха записани.");
        setItems((xs) =>
          xs.map((x) => (x.id === editing ? { ...x, ...row, price: row.price != null ? String(row.price) : "" } as Service : x)),
        );
        toast.success("Услугата е обновена.");
      }
      setEditing(null);
      setForm(blank);
      router.refresh();
    });
  }

  function remove(id: string) {
    start(async () => {
      const { error } = await supabase.from("services").delete().eq("id", id);
      if (error) return void toast.error("Услугата не беше изтрита.");
      setItems((xs) => xs.filter((x) => x.id !== id));
      toast.success("Услугата е изтрита.");
      router.refresh();
    });
  }

  return (
    <section aria-labelledby="svc-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 id="svc-heading" className="display text-4xl">
          Ценоразпис
        </h2>
        {editing === null && (
          <button type="button" className="btn btn-primary" onClick={() => edit()}>
            <Plus className="size-4" aria-hidden /> Добави услуга
          </button>
        )}
      </div>
      <p className="mt-1 text-ink-2">Конкретни услуги с фиксирана цена, „от X €“ или „по оглед“.</p>

      {items.length === 0 && editing === null && (
        <div className="mt-4">
          <EmptyState title="Още нямаш услуги">
            Добави цена на услугите, които си отметнал в профила, или 3–5 от най-честите си задачи, напр. „Смяна
            на контакт – 15 €“.
          </EmptyState>
        </div>
      )}

      {editing === null && unpriced.length > 0 && (
        <p className="mt-3 text-sm text-ink-2">
          Без цена още: {unpriced.map((c) => c.name).join(", ")}.
        </p>
      )}

      {items.length > 0 && (
        <ul className="mt-4 grid border-t-[1.5px] border-ink">
          {items.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line py-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{s.name}</p>
                {(s.description || s.category_id) && (
                  <p className="text-sm text-ink-3">
                    {[categories.find((c) => c.id === s.category_id)?.name, s.description].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <p className={s.price_kind === "quote" ? "font-semibold text-ink-2" : "numerals text-2xl"}>
                {servicePrice(s.price_kind, s.price === "" ? null : s.price, s.unit)}
              </p>
              <div className="flex gap-1">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => edit(s)} aria-label={`Редактирай ${s.name}`}>
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm text-danger"
                  disabled={pending}
                  onClick={() => remove(s.id)}
                  aria-label={`Изтрий ${s.name}`}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing !== null && (
        <form onSubmit={save} className="mt-4 grid gap-4 rounded-[10px] border-[1.5px] border-ink bg-surface p-5" noValidate>
          <h3 className="text-lg font-extrabold">{editing === "new" ? "Нова услуга" : "Редакция на услуга"}</h3>
          <div>
            <label htmlFor="s-name" className="label">
              Име на услугата
            </label>
            <input
              id="s-name"
              className="field"
              value={form.name}
              maxLength={120}
              placeholder="напр. Смяна на смесител"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "s-name-err" : undefined}
            />
            {errors.name && (
              <p id="s-name-err" className="error-text">
                {errors.name}
              </p>
            )}
            {editing === "new" && unpriced.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-ink-2">Или избери от отметнатите в профила (още без цена):</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {unpriced.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className="chip"
                      aria-pressed={pick === String(c.id)}
                      onClick={() => pickCategory(String(c.id))}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <fieldset>
            <legend className="label">Цена</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["fixed", "Точна цена"],
                  ["from", "От … €"],
                  ["quote", "По оглед"],
                ] as const
              ).map(([k, label]) => (
                <button key={k} type="button" className="chip" aria-pressed={form.kind === k} onClick={() => setForm({ ...form, kind: k })}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          {form.kind !== "quote" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="s-price" className="label">
                  {form.kind === "from" ? "Начална цена (€)" : "Цена (€)"}
                </label>
                <input
                  id="s-price"
                  className="field"
                  inputMode="decimal"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  aria-invalid={Boolean(errors.price)}
                  aria-describedby={errors.price ? "s-price-err" : undefined}
                />
                {errors.price && (
                  <p id="s-price-err" className="error-text">
                    {errors.price}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="s-unit" className="label">
                  Мерна единица
                </label>
                <select id="s-unit" className="field" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as PriceUnit })}>
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {(editing !== "new" || pick === OTHER || unpriced.length === 0) && (
            <div>
              <label htmlFor="s-cat" className="label">
                Категория <span className="font-normal text-ink-3">(по желание)</span>
              </label>
              <select id="s-cat" className="field" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                <option value="">Без категория</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            )}
            <div>
              <label htmlFor="s-desc" className="label">
                Уточнение <span className="font-normal text-ink-3">(по желание)</span>
              </label>
              <input
                id="s-desc"
                className="field"
                maxLength={300}
                placeholder="напр. без материалите"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Записваме…" : editing === "new" ? "Добави" : "Запази"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
              Откажи
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
