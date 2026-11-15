"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { savePrices, type TermsInput } from "@/app/actions/dashboard";
import { createClient } from "@/lib/supabase/client";
import { toMoney } from "@/lib/validation";
import type { PriceKind, PriceUnit } from "@/lib/format";
import type { BoxKind } from "@/lib/prices";
import {
  AddServiceButton,
  FullNote,
  GroupHint,
  isMoney,
  LimitLine,
  PageHead,
  PriceEditor,
  PriceTag,
  ProNote,
  SaveBar,
  ServiceForm,
  ServiceRow,
  SuggestionRow,
  TermsFields,
  st,
  type ServiceDraft,
} from "./price-parts";

export type BoardBox = { id: number; name: string; kind: BoxKind | null; price: string; unit: PriceUnit }; // id = id на подкатегорията
export type BoardHint = { hourly: [number, number] | null; job: [number, number] | null; scope: "city" | "all" };
export type BoardGroup = { id: number; name: string; boxes: BoardBox[]; hint: BoardHint | null };
export type BoardService = {
  id: string;
  name: string;
  description: string | null;
  kind: PriceKind;
  price: string;
  unit: PriceUnit;
  categoryId: number | null;
  categoryName: string | null;
  templateId: number | null;
  typicalHours: number | null;
};
export type BoardTemplate = {
  id: number;
  name: string;
  unit: PriceUnit;
  categoryId: number;
  typicalHours: number;
  range: { p25: number; p75: number; scope: "city" | "all" } | null; // only with proHints
};
type FormAt = { catId: number | null; id?: string }; // where the one open service form is

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * „Кутии“: one box per checked subcategory under a yellow band that shows the price as clients see it. Services and
 * ready-made jobs sit inside the box and are saved at once; category prices and terms are saved together with the dark
 * bar (as on „Профил“).
 */
export function PricesBoard({
  groups,
  terms: initialTerms,
  cityName,
  proHints,
  limit,
  userId,
  services: initialServices,
  templates,
}: {
  groups: BoardGroup[];
  terms: TermsInput;
  cityName: string | null;
  proHints: boolean;
  limit: number | null;
  userId: string;
  services: BoardService[];
  templates: BoardTemplate[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const initialBoxes = groups.flatMap((g) => g.boxes);
  const [boxes, setBoxes] = useState<BoardBox[]>(initialBoxes);
  const [terms, setTerms] = useState<TermsInput>(initialTerms);
  const [saved, setSaved] = useState<{ boxes: BoardBox[]; terms: TermsInput }>({ boxes: initialBoxes, terms: initialTerms });
  const [pending, setPending] = useState(false);
  const [items, setItems] = useState<BoardService[]>(initialServices);
  const [form, setForm] = useState<FormAt | null>(null); // at most one service form on the whole page
  const [busy, setBusy] = useState(false);
  const used = items.length;
  const full = limit != null && used >= limit;

  const boxOf = (id: number) => boxes.find((b) => b.id === id);
  const taken = new Set(items.map((s) => s.templateId).filter((x): x is number => x != null));
  const others = items.filter((s) => s.categoryId == null || !boxOf(s.categoryId));
  const closeForm = () => setForm(null);
  const formProps = { boxes, templates, proHints, cityName, onSave: saveService, onDone: closeForm };
  const boxDirty = (b: BoardBox) => !same(b, saved.boxes.find((x) => x.id === b.id));
  const termsDirty = !same(terms, saved.terms);
  const dirty = boxes.some(boxDirty) || termsDirty;

  function setBox(id: number, next: BoardBox) {
    setBoxes((bs) => bs.map((b) => (b.id === id ? next : b)));
  }

  /** Adds or changes a service; returns true when it was saved. */
  async function saveService(d: ServiceDraft): Promise<boolean> {
    const row = {
      name: d.name,
      description: d.description || null,
      price_kind: d.kind,
      price: d.kind === "quote" ? null : toMoney(d.price),
      unit: d.unit,
      category_id: d.categoryId,
    };
    const shownPrice = row.price != null ? String(row.price) : ""; // a comma becomes a point
    const categoryName = d.categoryId != null ? (boxOf(d.categoryId)?.name ?? null) : null;
    if (d.id) {
      const { error } = await supabase.from("services").update(row).eq("id", d.id);
      if (error) {
        toast.error("Промените не бяха записани.");
        return false;
      }
      setItems((xs) =>
        xs.map((x) =>
          x.id === d.id
            ? {
                ...x,
                name: d.name,
                description: d.description || null,
                kind: d.kind,
                price: shownPrice,
                unit: d.unit,
                categoryId: d.categoryId,
                categoryName: d.categoryId === x.categoryId ? x.categoryName : categoryName,
              }
            : x,
        ),
      );
      toast.success("Услугата е обновена.");
      router.refresh();
      return true;
    }
    if (full) {
      toast.error(`Безплатният план е до ${limit} услуги. Изтрий една или мини на Pro.`);
      return false;
    }
    const { data, error } = await supabase
      .from("services")
      .insert({ ...row, craftsman_id: userId, sort: items.length, template_id: d.templateId })
      .select("id")
      .single();
    if (error || !data) {
      toast.error(error?.message.startsWith("Безплатният план") ? error.message : "Услугата не беше добавена.");
      return false;
    }
    const tpl = d.templateId != null ? templates.find((t) => t.id === d.templateId) : undefined;
    setItems((xs) => [
      ...xs,
      {
        id: data.id,
        name: d.name,
        description: d.description || null,
        kind: d.kind,
        price: shownPrice,
        unit: d.unit,
        categoryId: d.categoryId,
        categoryName,
        templateId: d.templateId,
        typicalHours: tpl?.typicalHours ?? null,
      },
    ]);
    toast.success(`„${d.name}“ е добавена.`);
    router.refresh();
    return true;
  }

  async function addTemplate(t: BoardTemplate, raw: string): Promise<boolean> {
    const price = raw.trim();
    if (price && !isMoney(price)) {
      toast.error("Напиши цената с числа, например 35.");
      return false;
    }
    return saveService({
      name: t.name,
      kind: price ? "fixed" : "quote",
      price,
      unit: t.unit,
      description: "",
      categoryId: t.categoryId,
      templateId: t.id,
    });
  }

  async function removeService(s: BoardService) {
    setBusy(true);
    try {
      const { error } = await supabase.from("services").delete().eq("id", s.id);
      if (error) return void toast.error("Услугата не беше изтрита.");
      setItems((xs) => xs.filter((x) => x.id !== s.id));
      toast.success(`„${s.name}“ е изтрита.`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const missing = boxes.find((b) => {
      if (!b.kind || b.kind === "quote") return false;
      const p = b.price.trim();
      const n = toMoney(p);
      return !/^\d+([.,]\d{1,2})?$/.test(p) || !(n !== null && n > 0 && n < 100000);
    });
    if (missing) return void toast.error(`Напиши цена в „${missing.name}“ или избери „По оглед“.`);
    setPending(true);
    try {
      const res = await savePrices({
        boxes: boxes.flatMap((b) => (b.kind ? [{ categoryId: b.id, kind: b.kind, price: b.price, unit: b.unit }] : [])),
        terms,
      });
      if (!res.ok) return void toast.error(res.message);
      toast.success(res.message);
      setSaved({ boxes, terms });
      router.refresh();
    } catch {
      toast.error("Цените не бяха записани. Опитайте отново.");
    } finally {
      setPending(false);
    }
  }
  function cancel() {
    setBoxes(saved.boxes);
    setTerms(saved.terms);
  }

  return (
    <div className={dirty ? "pb-24" : ""}>
      <PageHead>
        <div className="mt-4 grid gap-1.5">
          <LimitLine limit={limit} used={used} />
          <ProNote proHints={proHints} cityName={cityName} />
        </div>
      </PageHead>

      <div className="mt-10 grid max-w-3xl gap-10">
        {groups.length === 0 ? (
          <section className={st.shell}>
            <div className={st.body}>
              <p className="rounded-[8px] bg-paper p-4 text-ink-2">
                Още нямаш отметнати категории. Отметни какво работиш в{" "}
                <Link href="/tabla/profil?chast=kakvo" className="link font-bold">
                  Профил
                </Link>{" "}
                и тук ще излезе кутия с цена за всяка.
              </p>
            </div>
          </section>
        ) : (
          groups.map((g) => (
            <section key={g.id} aria-label={g.name}>
              <h2 className={st.group}>{g.name}</h2>
              {proHints && <GroupHint hint={g.hint} cityName={cityName} />}
              <div className="grid gap-4">
                {g.boxes.map((gb) => {
                  const b = boxOf(gb.id) ?? gb;
                  const svcs = items.filter((x) => x.categoryId === b.id);
                  const tpls = templates.filter((t) => t.categoryId === b.id && !taken.has(t.id));
                  const adding = form?.catId === b.id && !form.id;
                  return (
                    <article key={b.id} aria-labelledby={`k-b-${b.id}`} className={st.shell}>
                      <div className={st.head}>
                        {/* the rivet sits beside the heading, not in it, so the heading's name stays the category's name */}
                        <div className="relative min-w-0">
                          <h3 id={`k-b-${b.id}`} className={st.title}>
                            {b.name}
                          </h3>
                          {boxDirty(b) && <Rivet />}
                        </div>
                        <PriceTag box={b} className="text-[1.9rem]" />
                      </div>
                      <div className={st.body}>
                        <PriceEditor box={b} onChange={(next) => setBox(b.id, next)} idp={`k-${b.id}`} />

                        <div>
                          <h4 className={st.groupSm}>
                            Услуги <span className="font-sans text-sm font-normal text-ink-3">(по желание)</span>
                          </h4>
                          {svcs.length > 0 && (
                            <ul className={st.panel}>
                              {svcs.map((s) =>
                                form?.id === s.id ? (
                                  <li key={s.id}>
                                    <ServiceForm {...formProps} box={b} editing={s} surface="bg-surface" />
                                  </li>
                                ) : (
                                  <ServiceRow
                                    key={s.id}
                                    s={s}
                                    disabled={busy}
                                    onEdit={() => setForm({ catId: b.id, id: s.id })}
                                    onDelete={() => void removeService(s)}
                                  />
                                ),
                              )}
                            </ul>
                          )}
                          <div className={svcs.length > 0 ? "mt-3" : ""}>
                            {adding ? (
                              <ServiceForm {...formProps} box={b} />
                            ) : full ? (
                              <FullNote used={used} limit={limit} />
                            ) : (
                              <AddServiceButton onClick={() => setForm({ catId: b.id })} />
                            )}
                          </div>
                        </div>

                        {tpls.length > 0 && (
                          <div>
                            <h4 className={st.groupSm}>Готови работи</h4>
                            <p className="-mt-1 mb-2 text-sm text-ink-2">Напиши цена и натисни „Добави“. Без цена работата излиза „по оглед“.</p>
                            <ul className={st.panel}>
                              {tpls.map((t) => (
                                <SuggestionRow key={t.id} t={t} box={b} full={full} proHints={proHints} onAdd={addTemplate} />
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}

        {others.length > 0 && (
          <section aria-labelledby="k-other">
            <h2 id="k-other" className={st.group}>
              Други услуги
            </h2>
            <p className="mb-3 text-ink-2">Категорията им вече не е отметната в профила. Клиентите не ги виждат.</p>
            <ul className={st.list}>
              {others.map((s) =>
                form?.id === s.id ? (
                  <li key={s.id}>
                    <ServiceForm {...formProps} box={null} editing={s} surface="bg-surface" />
                  </li>
                ) : (
                  <ServiceRow
                    key={s.id}
                    s={s}
                    disabled={busy}
                    onEdit={() => setForm({ catId: s.categoryId, id: s.id })}
                    onDelete={() => void removeService(s)}
                  />
                ),
              )}
            </ul>
          </section>
        )}

        <section aria-labelledby="k-terms" className={st.shell}>
          <div className={st.head}>
            <div className="relative">
              <h2 id="k-terms" className={st.title}>
                Условия
              </h2>
              {termsDirty && <Rivet />}
            </div>
          </div>
          <div className={st.body}>
            <p className="-mb-1 text-ink-2">Важат за всички категории.</p>
            <TermsFields terms={terms} onChange={setTerms} idp="k-terms" />
          </div>
        </section>
      </div>

      {dirty && <SaveBar onSave={save} onCancel={cancel} pending={pending} />}
    </div>
  );
}

function Rivet() {
  return <span className={`${st.rivet} absolute -right-3.5 top-1`} role="img" aria-label="има незаписани промени" />;
}
