"use client";

import Link from "next/link";
import { useState } from "react";
import { Lock, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { isMoneyText } from "@/lib/validation";
import { BOX_KINDS, BOX_UNITS, hourEstimate, priceText, type BoxKind } from "@/lib/prices";
import { servicePrice, UNIT_LABEL, UNIT_OPTIONS, UNIT_SHORT, type PriceKind, type PriceUnit } from "@/lib/format";
import type { TermsInput } from "@/app/actions/dashboard";
import type { BoardBox, BoardHint, BoardService, BoardTemplate } from "./prices-board";

/* Pieces of the „Цени и услуги“ board. Separation without lines: strips on the card surface, 4px apart,
 * boxes under a yellow band, the quiet part one step back on the paper. */

export const st = {
  group: "display mb-2 text-[1.7rem]",
  groupSm: "display mb-2 text-[1.45rem]",
  list: "grid gap-1",
  panel: "grid gap-1 rounded-[8px] bg-paper p-1.5",
  act: "btn btn-sm max-sm:min-h-11",
  shell: "grid overflow-hidden rounded-[10px] bg-surface",
  head: "flex items-center justify-between gap-3 bg-rule px-5 py-2.5",
  title: "display text-3xl",
  body: "grid gap-5 p-5",
  lead: "mt-2 max-w-2xl text-lg text-ink-2",
  rivet: "inline-block size-2.5 shrink-0 rounded-full bg-brass shadow-[inset_0_0_0_1.5px_rgb(22_20_15/0.75)]",
};

/** Service and terms sums: 0 is allowed here (a box price is not, see save()). */
export const isMoney = (v: string) => isMoneyText(v, true);

/* ------------------------------------------------------------------------------------------------
 * Page head, plan notes, the limit counter
 * ---------------------------------------------------------------------------------------------- */

export function PageHead({ children }: { children?: React.ReactNode }) {
  return (
    <div>
      <h1 className="display text-5xl sm:text-6xl">Цени и услуги</h1>
      <p className={st.lead}>
        Сложи цена на всяка категория, която работиш. Под нея можеш да добавиш и конкретни услуги с тяхна цена. Клиентите виждат
        цените в профила ти и в търсенето.
      </p>
      {children}
    </div>
  );
}

/** „5 от 8 услуги“, and at the limit a lock with the way out. Category prices are not counted. */
export function LimitLine({ limit, used }: { limit: number | null; used: number }) {
  if (limit == null) return null;
  const full = used >= limit;
  return (
    <p className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.95rem] ${full ? "text-ink" : "text-ink-2"}`}>
      {full && <Lock className="size-4 shrink-0 self-center" aria-hidden />}
      <span>
        <span className="numerals text-[1.35rem]">
          {used} от {limit}
        </span>{" "}
        <span className="font-semibold">услуги</span>
      </span>
      <span className="text-ink-3">{full ? "Безплатният план е пълен." : "Цените на категориите не се броят."}</span>
      {full && (
        <Link href="/tabla/plan" className="link font-bold">
          Виж Pro
        </Link>
      )}
    </p>
  );
}

/** Free plan: one quiet line about what Pro adds here. */
export function ProNote({ proHints, cityName }: { proHints: boolean; cityName: string | null }) {
  if (proHints) return null;
  return (
    <p className="flex items-start gap-2 text-sm text-ink-2">
      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        {cityName ? `Колко вземат колегите в ${cityName} се вижда в Pro.` : "Колко вземат колегите се вижда в Pro."}{" "}
        <Link href="/tabla/plan" className="link font-bold">
          Виж плановете
        </Link>
      </span>
    </p>
  );
}

/** Pro: what colleagues charge in this top category. Only the halves that exist are shown. */
export function GroupHint({ hint, cityName }: { hint: BoardHint | null; cityName: string | null }) {
  if (!hint || (!hint.hourly && !hint.job)) return null;
  const where = hint.scope === "city" && cityName ? `в ${cityName}` : "в страната";
  const hourly = hint.hourly && (
    <span className="numerals text-base">
      {hint.hourly[0]}–{hint.hourly[1]} €/ч
    </span>
  );
  const job = hint.job && (
    <span className="numerals text-base">
      {hint.job[0]}–{hint.job[1]} €
    </span>
  );
  return (
    <p className="mb-3 text-sm text-ink-2">
      Колегите {where} вземат {hourly}
      {hourly && job && " или "}
      {job}
      {job && " на услуга"}. Само за ориентир.
    </p>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The price of a category
 * ---------------------------------------------------------------------------------------------- */

const KIND_HINT: Record<BoxKind, string> = {
  fixed: "Една цена за обичайната работа в тази категория.",
  from: "Клиентите виждат „от …“. Точната сума казваш в чата.",
  hour: "Клиентите виждат цената на час. Работите „по оглед“ получават ориентировъчна сума от нея.",
  quote: "Клиентите виждат „по оглед“, без сума.",
};

/** Four kinds of price and, for a sum, the amount (and the unit for a fixed or „от“ price). */
export function PriceEditor({ box, onChange, idp }: { box: BoardBox; onChange: (b: BoardBox) => void; idp: string }) {
  const sum = box.kind && box.kind !== "quote";
  const bad = sum && box.price.trim() !== "" && !isMoney(box.price);
  return (
    <fieldset className="grid gap-3">
      <legend className="label">{box.kind ? "Как вземаш" : "Още няма цена. Как вземаш за тази работа?"}</legend>
      <div className="flex flex-wrap gap-2">
        {BOX_KINDS.map(({ k, label }) => (
          <button
            key={k}
            type="button"
            className="chip max-sm:min-h-11"
            aria-pressed={box.kind === k}
            onClick={() => onChange({ ...box, kind: k, unit: k === "hour" ? "hour" : box.unit === "hour" ? "job" : box.unit })}
          >
            {label}
          </button>
        ))}
      </div>
      {sum && (
        <div className="flex flex-wrap items-start gap-2">
          <div className="relative w-36">
            <input
              id={`${idp}-price`}
              className="field numerals !text-[1.35rem] pr-12"
              inputMode="decimal"
              value={box.price}
              placeholder={box.kind === "from" ? "най-малко" : ""}
              aria-label={box.kind === "from" ? "Начална цена в евро" : box.kind === "hour" ? "Цена на час в евро" : "Цена в евро"}
              aria-invalid={bad || undefined}
              onChange={(e) => onChange({ ...box, price: e.target.value })}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-bold text-ink-3">
              {box.kind === "hour" ? "€/ч" : "€"}
            </span>
          </div>
          {box.kind !== "hour" && (
            <select
              className="field w-auto min-w-40"
              aria-label="Мерна единица"
              value={box.unit}
              onChange={(e) => onChange({ ...box, unit: e.target.value as PriceUnit })}
            >
              {BOX_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      {bad ? <p className="error-text !mt-0">Напиши цената с числа, например 25.</p> : box.kind && <p className="hint !mt-0">{KIND_HINT[box.kind]}</p>}
    </fieldset>
  );
}

/** A box's price as clients see it, in the condensed numerals (or a quiet „без цена“). */
export function PriceTag({ box, className = "text-[1.7rem]" }: { box: BoardBox; className?: string }) {
  const p = priceText(box.kind, box.price, box.unit);
  if (!p) return <span className="text-[0.95rem] font-semibold text-ink-2">без цена</span>;
  if (p === "по оглед") return <span className="text-[0.95rem] font-bold">по оглед</span>;
  return <span className={`numerals whitespace-nowrap leading-none ${className}`}>{p}</span>;
}

/* ------------------------------------------------------------------------------------------------
 * Services and ready-made jobs, inside the boxes
 * ---------------------------------------------------------------------------------------------- */

const SVC_KINDS: { k: PriceKind; label: string }[] = [
  { k: "fixed", label: "Точна цена" },
  { k: "from", label: "От … €" },
  { k: "quote", label: "По оглед" },
];

/** What a service is saved with (the form's result). `id` is set when an existing service is changed. */
export type ServiceDraft = {
  id?: string;
  name: string;
  kind: PriceKind;
  price: string;
  unit: PriceUnit;
  description: string;
  categoryId: number | null;
  templateId: number | null;
};

/** One service as a strip: name, its note, the price, edit and delete. */
export function ServiceRow({
  s,
  onEdit,
  onDelete,
  disabled,
  className = "bg-surface",
}: {
  s: BoardService;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
  className?: string;
}) {
  const quote = s.kind === "quote";
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[6px] py-2 pl-3 pr-1.5 ${className}`}>
      <div className="min-w-0 flex-1 py-1">
        <p className="font-bold leading-snug">{s.name}</p>
        {s.description && <p className="text-sm text-ink-3">{s.description}</p>}
      </div>
      <p className={quote ? "text-[0.95rem] font-semibold text-ink-2" : "numerals whitespace-nowrap text-2xl"}>
        {servicePrice(s.kind, s.price.trim() === "" ? null : s.price, s.unit)}
      </p>
      <div className="flex">
        <button type="button" className={`${st.act} btn-ghost`} onClick={onEdit} aria-label={`Промени „${s.name}“`}>
          <Pencil className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          className={`${st.act} btn-ghost text-danger`}
          disabled={disabled}
          onClick={onDelete}
          aria-label={`Изтрий „${s.name}“`}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}

/**
 * The service form, drawn where the button (or the row being changed) was. `box` is the box it was opened in (null for a
 * service under „Други услуги“); `boxes` are the ticked subcategories. A service that is in no box keeps its own category
 * as the first choice, so it is not changed without need.
 */
export function ServiceForm({
  editing,
  box,
  boxes,
  templates,
  proHints,
  cityName,
  onSave,
  onDone,
  surface = "bg-paper",
}: {
  editing?: BoardService;
  box: BoardBox | null;
  boxes: BoardBox[];
  templates: BoardTemplate[];
  proHints: boolean;
  cityName: string | null;
  onSave: (d: ServiceDraft) => Promise<boolean>;
  onDone: () => void;
  surface?: string;
}) {
  const [d, setD] = useState<ServiceDraft>(
    editing
      ? {
          id: editing.id,
          name: editing.name,
          kind: editing.kind,
          price: editing.price,
          unit: editing.unit,
          description: editing.description ?? "",
          categoryId: editing.categoryId,
          templateId: editing.templateId,
        }
      : { name: "", kind: "fixed", price: "", unit: "job", description: "", categoryId: box?.id ?? null, templateId: null },
  );
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});
  const [pending, setPending] = useState(false);
  const idp = `svc-${editing?.id ?? `new-${box?.id}`}`;
  const own = editing && !boxes.some((b) => b.id === editing.categoryId) ? editing : null;
  const range = d.templateId != null ? templates.find((t) => t.id === d.templateId)?.range : null;
  const est = d.templateId != null && editing ? hourEstimate(boxes.find((b) => b.id === editing.categoryId), editing.typicalHours) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err: typeof errors = {};
    if (d.name.trim().length < 2) err.name = "Напиши име на услугата.";
    if (d.kind !== "quote" && !isMoney(d.price)) {
      err.price = d.price.trim() ? "Напиши цената с числа, например 35." : "Напиши цена или избери „По оглед“.";
    }
    setErrors(err);
    if (err.name || err.price) return;
    setPending(true);
    try {
      const ok = await onSave({ ...d, name: d.name.trim(), price: d.kind === "quote" ? "" : d.price.trim(), description: d.description.trim() });
      if (ok) onDone();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className={`grid gap-4 rounded-[8px] p-4 ${surface}`}>
      <p className="text-lg font-extrabold">{editing ? `Промяна на „${editing.name}“` : `Нова услуга в „${box?.name}“`}</p>
      <div>
        <label htmlFor={`${idp}-name`} className="label">
          Име на услугата
        </label>
        <input
          id={`${idp}-name`}
          className="field"
          value={d.name}
          maxLength={120}
          placeholder="напр. Смяна на бушон"
          aria-invalid={Boolean(errors.name) || undefined}
          onChange={(e) => setD({ ...d, name: e.target.value, templateId: null })}
        />
        {errors.name && <p className="error-text">{errors.name}</p>}
      </div>
      <fieldset>
        <legend className="label">Цена</legend>
        <div className="flex flex-wrap gap-2">
          {SVC_KINDS.map(({ k, label }) => (
            <button key={k} type="button" className="chip max-sm:min-h-11" aria-pressed={d.kind === k} onClick={() => setD({ ...d, kind: k })}>
              {label}
            </button>
          ))}
        </div>
        {d.kind !== "quote" ? (
          <div className="mt-3 flex flex-wrap items-start gap-2">
            <div className="relative w-36">
              <input
                className="field numerals !text-[1.35rem] pr-10"
                inputMode="decimal"
                value={d.price}
                aria-label={d.kind === "from" ? "Начална цена в евро" : "Цена в евро"}
                aria-invalid={Boolean(errors.price) || undefined}
                onChange={(e) => setD({ ...d, price: e.target.value })}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-bold text-ink-3">€</span>
            </div>
            <select
              className="field w-auto min-w-40"
              aria-label="Мерна единица"
              value={d.unit}
              onChange={(e) => setD({ ...d, unit: e.target.value as PriceUnit })}
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="hint">Клиентите виждат „по оглед“{est ? ` и ориентировъчно ≈ ${est} €${UNIT_SHORT[d.unit]} от цената ти на час.` : "."}</p>
        )}
        {errors.price && <p className="error-text">{errors.price}</p>}
        {proHints && range && (
          <p className="hint">
            Колегите {range.scope === "city" && cityName ? `в ${cityName}` : "в страната"} вземат {range.p25}–{range.p75} € за тази работа.
          </p>
        )}
      </fieldset>
      {editing && (
        <div>
          <label htmlFor={`${idp}-cat`} className="label">
            Категория
          </label>
          <select
            id={`${idp}-cat`}
            className="field"
            value={d.categoryId ?? ""}
            onChange={(e) => setD({ ...d, categoryId: e.target.value === "" ? null : Number(e.target.value) })}
          >
            {own && <option value={own.categoryId ?? ""}>{own.categoryName ?? "Без категория"}</option>}
            {boxes.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label htmlFor={`${idp}-desc`} className="label">
          Уточнение <span className="font-normal text-ink-3">(по желание)</span>
        </label>
        <input
          id={`${idp}-desc`}
          className="field"
          maxLength={300}
          placeholder="напр. без материалите"
          value={d.description}
          onChange={(e) => setD({ ...d, description: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Записваме…" : editing ? "Запази" : "Добави"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Откажи
        </button>
      </div>
    </form>
  );
}

const templateUnit = (u: PriceUnit) => BOX_UNITS.find((x) => x.value === u)?.label ?? UNIT_LABEL[u];

/** A ready-made job: write a price and add it. Empty = „по оглед“ (with „≈ X €“ when the box is per hour). */
export function SuggestionRow({
  t,
  box,
  full,
  proHints,
  onAdd,
  className = "bg-surface",
}: {
  t: BoardTemplate;
  box: BoardBox | null;
  full: boolean;
  proHints: boolean;
  onAdd: (t: BoardTemplate, price: string) => Promise<boolean>;
  className?: string;
}) {
  const [price, setPrice] = useState("");
  const [pending, setPending] = useState(false);
  const est = hourEstimate(box, t.typicalHours);
  const add = async () => {
    if (pending || full) return;
    setPending(true);
    try {
      if (await onAdd(t, price)) setPrice("");
    } finally {
      setPending(false);
    }
  };
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[6px] px-3 py-2 ${className}`}>
      <div className="min-w-0 flex-[1_1_14rem]">
        <p className="font-semibold leading-snug">{t.name}</p>
        <p className="text-sm text-ink-3">
          {price.trim() === "" ? (est ? `Без цена: по оглед, ≈ ${est} €${UNIT_SHORT[t.unit]}` : "Без цена: по оглед") : templateUnit(t.unit)}
          {proHints && t.range && (
            <>
              {" · "}
              <span className="font-semibold text-ink-2">
                колегите вземат {t.range.p25}–{t.range.p75} €
              </span>
            </>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative w-24">
          <input
            className="field numerals !text-[1.2rem] pr-8"
            inputMode="decimal"
            value={price}
            aria-label={`Цена за „${t.name}“`}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-bold text-ink-3">€</span>
        </div>
        <button type="button" className="btn btn-outline btn-sm max-sm:min-h-11" disabled={full || pending} onClick={() => void add()}>
          <Plus className="size-4" aria-hidden /> Добави
        </button>
      </div>
    </li>
  );
}

/** „Добави услуга“. */
export function AddServiceButton({ onClick, label = "Добави услуга", className = "btn-outline" }: { onClick: () => void; label?: string; className?: string }) {
  return (
    <button type="button" className={`btn ${className}`} onClick={onClick}>
      <Plus className="size-4" aria-hidden /> {label}
    </button>
  );
}

/** In place of „Добави услуга“ when the free plan is full: the reason and the way out, right where the button was. */
export function FullNote({ used, limit }: { used: number; limit: number | null }) {
  return (
    <p className="flex items-start gap-2 rounded-[6px] bg-paper px-3 py-2.5 text-[0.95rem] text-ink">
      <Lock className="mt-1 size-4 shrink-0" aria-hidden />
      <span>
        Планът е пълен:{" "}
        <span className="font-semibold">
          {used} от {limit} услуги
        </span>
        . Изтрий услуга или{" "}
        <Link href="/tabla/plan" className="link font-bold">
          виж Pro
        </Link>
        .
      </span>
    </p>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Terms: visit, travel, materials, inspection, how I work
 * ---------------------------------------------------------------------------------------------- */

const POLICIES: { value: TermsInput["policy"]; label: string; hint: string }[] = [
  { value: "free", label: "Безплатен оглед", hint: "Идвам да видя обекта без заплащане." },
  { value: "paid", label: "Платен оглед", hint: "Огледът се плаща отделно." },
  { value: "deducted", label: "Платен, приспада се", hint: "Плаща се, но се приспада от цената, ако работата ми се възложи." },
  { value: "none", label: "Без оглед", hint: "Идвам направо за работа, цената се уточнява в чата." },
];

function Money({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: string; onChange: (v: string) => void }) {
  const bad = value.trim() !== "" && !isMoney(value);
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="relative max-w-44">
        <input
          id={id}
          className="field numerals !text-[1.35rem] pr-10"
          inputMode="decimal"
          value={value}
          aria-invalid={bad || undefined}
          aria-describedby={`${id}-hint`}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-bold text-ink-3">€</span>
      </div>
      {bad ? (
        <p className="error-text">Напиши сумата с числа.</p>
      ) : (
        <p id={`${id}-hint`} className="hint max-w-md">
          {hint}
        </p>
      )}
    </div>
  );
}

/** The fields of the terms block. */
export function TermsFields({ terms, onChange, idp }: { terms: TermsInput; onChange: (t: TermsInput) => void; idp: string }) {
  const paid = terms.policy === "paid" || terms.policy === "deducted";
  const set = (patch: Partial<TermsInput>) => onChange({ ...terms, ...patch });
  const row =
    "flex cursor-pointer items-start gap-3 rounded-[6px] bg-paper px-3 py-3 transition-colors motion-reduce:transition-none has-[:checked]:bg-rule-soft";
  return (
    <div className="grid gap-7">
      <div className="grid gap-5 sm:grid-cols-2">
        <Money
          id={`${idp}-callout`}
          label="Такса посещение"
          hint="Най-малката сума, когато идваш да работиш. Ако работата излезе по-евтино, клиентът плаща тази сума."
          value={terms.callout}
          onChange={(v) => set({ callout: v })}
        />
        <Money
          id={`${idp}-travel`}
          label="Транспорт извън града"
          hint="По желание. Добавя се при адрес извън града ти."
          value={terms.travel}
          onChange={(v) => set({ travel: v })}
        />
      </div>

      <fieldset>
        <legend className="display mb-1 text-[1.45rem]">Оглед</legend>
        <p className="mb-3 max-w-xl text-[0.95rem] text-ink-2">
          Отделно идване само за да видиш обекта и да кажеш цена. Не е посещението за работа.
        </p>
        <div className="grid gap-1 sm:grid-cols-2">
          {POLICIES.map((p) => (
            <label key={p.value} className={row}>
              <input
                type="radio"
                name={`${idp}-policy`}
                className="check mt-0.5"
                checked={terms.policy === p.value}
                onChange={() => set({ policy: p.value })}
              />
              <span>
                <span className="block font-bold">{p.label}</span>
                <span className="block text-sm text-ink-2">{p.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {paid && (
          <div className="mt-4">
            <Money
              id={`${idp}-insp`}
              label="Цена на огледа"
              hint={terms.policy === "deducted" ? "Приспада се от цената, ако работата ти се възложи." : "Плаща се отделно от работата."}
              value={terms.inspectionFee}
              onChange={(v) => set({ inspectionFee: v })}
            />
          </div>
        )}
      </fieldset>

      <div className="grid gap-1">
        <label className={row}>
          <input type="checkbox" className="check mt-0.5" checked={terms.materials} onChange={(e) => set({ materials: e.target.checked })} />
          <span>
            <span className="block font-bold">Материалите са включени в цената</span>
            <span className="block text-sm text-ink-2">Иначе клиентите виждат „материалите се плащат отделно“.</span>
          </span>
        </label>
        <label className={row}>
          <input
            type="checkbox"
            className="check mt-0.5"
            checked={terms.quoteOnInspection}
            onChange={(e) => set({ quoteOnInspection: e.target.checked })}
          />
          <span>
            <span className="block font-bold">По-големите обекти са с цена след оглед</span>
            <span className="block text-sm text-ink-2">Клиентите го виждат до цените ти.</span>
          </span>
        </label>
      </div>

      <div>
        <label htmlFor={`${idp}-note`} className="display mb-2 block text-[1.45rem]">
          Как работя <span className="font-sans text-sm font-normal text-ink-3">(по желание)</span>
        </label>
        <textarea
          id={`${idp}-note`}
          rows={3}
          maxLength={600}
          className="field"
          value={terms.note}
          placeholder="напр. Малките ремонти правя направо. За бани и цели помещения първо идвам на оглед."
          onChange={(e) => set({ note: e.target.value })}
        />
        <p className="hint">Показва се под цените в профила ти.</p>
      </div>
    </div>
  );
}

/** The dark floating bar with „Отказ“ and „Запази“ (the same as on „Профил“), while something is unsaved. */
export function SaveBar({
  onSave,
  onCancel,
  pending,
  text = "Имаш незаписани промени",
}: {
  onSave: () => void;
  onCancel: () => void;
  pending: boolean;
  text?: string;
}) {
  return (
    <div
      role="region"
      aria-label="Незаписани промени"
      className="save-bar-in fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-xl flex-wrap items-center gap-1.5 rounded-[10px] bg-ink p-2 pl-4 text-white shadow-[var(--shadow-lg)] lg:bottom-5 lg:left-[calc(max((100vw-80rem)/2,0px)+18rem)] lg:right-auto lg:mx-0 lg:w-[36rem]"
    >
      <p className="flex-1 text-[0.95rem] font-semibold leading-tight">{text}</p>
      <button type="button" className="btn text-white hover:bg-white/10" onClick={onCancel} disabled={pending}>
        Отказ
      </button>
      <button type="button" className="btn btn-rule" onClick={onSave} disabled={pending} aria-disabled={pending}>
        {pending && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
        {pending ? "Записваме…" : "Запази"}
      </button>
    </div>
  );
}
