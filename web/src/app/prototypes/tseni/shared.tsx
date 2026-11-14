"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { formatEur } from "@/lib/format";
import { toMoney } from "@/lib/validation";
import {
  CITY,
  FREE_LIMIT,
  GROUPS,
  MORE_SERVICES,
  SERVICES,
  TEMPLATES,
  TERMS,
  type Box,
  type BoxKind,
  type Group,
  type Policy,
  type Service,
  type ServiceKind,
  type Template,
  type Terms,
  type Unit,
} from "./data";

/* ------------------------------------------------------------------------------------------------
 * Classes shared by the variants. Separation without lines: strips on the card surface, 4px apart,
 * boxes under a yellow band, the quiet part one step back on the paper.
 * ---------------------------------------------------------------------------------------------- */

export const st = {
  group: "display mb-2 text-[1.7rem]",
  groupSm: "display mb-2 text-[1.45rem]",
  list: "grid gap-1",
  strip: "rounded-[6px] bg-surface",
  stripPad: "px-3 py-3 sm:px-4",
  shell: "grid overflow-hidden rounded-[10px] bg-surface",
  head: "flex items-center justify-between gap-3 bg-rule px-5 py-2.5",
  title: "display text-3xl",
  body: "grid gap-5 p-5",
  panel: "grid gap-1 rounded-[8px] bg-paper p-1.5",
  act: "btn btn-sm max-sm:min-h-11",
  lead: "mt-2 max-w-2xl text-lg text-ink-2",
  rivet: "inline-block size-2.5 shrink-0 rounded-full bg-brass shadow-[inset_0_0_0_1.5px_rgb(22_20_15/0.75)]",
};

/* ------------------------------------------------------------------------------------------------
 * Formatting
 * ---------------------------------------------------------------------------------------------- */

const UNIT_SHORT: Record<Unit, string> = { job: "", hour: "/ч", m2: "/м²", piece: "/бр.", meter: "/л.м", day: "/ден" };

export function boxPrice(b: Pick<Box, "kind" | "price" | "unit">): string | null {
  if (!b.kind) return null;
  if (b.kind === "quote") return "по оглед";
  if (b.price.trim() === "") return null;
  if (b.kind === "hour") return `${formatEur(b.price)}/ч`;
  const base = `${formatEur(b.price)}${UNIT_SHORT[b.unit]}`;
  return b.kind === "from" ? `от ${base}` : base;
}

export function servicePrice(s: Pick<Service, "kind" | "price" | "unit">): string {
  if (s.kind === "quote" || s.price.trim() === "") return "по оглед";
  const base = `${formatEur(s.price)}${UNIT_SHORT[s.unit]}`;
  return s.kind === "from" ? `от ${base}` : base;
}

/** „≈ X €“ for a job left „по оглед“: only when its box is priced per hour (X €/ч × the usual time, to 5 €). */
export function estimate(box: Box | undefined, hours: number): number | null {
  if (!box || box.kind !== "hour") return null;
  const rate = toMoney(box.price);
  if (!rate) return null;
  return Math.max(5, Math.round((rate * hours) / 5) * 5);
}

const isMoney = (v: string) => {
  const n = toMoney(v);
  return n !== null && Number.isFinite(n) && n >= 0 && n < 100000;
};

/* ------------------------------------------------------------------------------------------------
 * Demo state: everything lives in memory and resets when the variant is switched.
 * ---------------------------------------------------------------------------------------------- */

let seq = 100;

export function useDemo(pro: boolean, startFull = false) {
  const [groups, setGroups] = useState<Group[]>(GROUPS);
  const [services, setServices] = useState<Service[]>(startFull ? [...SERVICES, ...MORE_SERVICES] : SERVICES);
  const [terms, setTerms] = useState<Terms>(TERMS);
  const limit = pro ? null : FREE_LIMIT;
  const used = services.length;
  const full = limit != null && used >= limit;

  const boxes = groups.flatMap((g) => g.boxes);
  const boxOf = (id: number) => boxes.find((b) => b.id === id);
  const taken = new Set(services.map((s) => s.templateId).filter((x): x is number => x != null));
  const openTemplates = (catId: number) => TEMPLATES.filter((t) => t.catId === catId && !taken.has(t.id));

  function setBox(id: number, next: Box) {
    setGroups((gs) => gs.map((g) => ({ ...g, boxes: g.boxes.map((b) => (b.id === id ? next : b)) })));
  }
  function setAllBoxes(next: Box[]) {
    setGroups((gs) => gs.map((g) => ({ ...g, boxes: g.boxes.map((b) => next.find((n) => n.id === b.id) ?? b) })));
  }

  /** Adds or updates a service; returns false when the free plan is full. */
  function saveService(s: Omit<Service, "id"> & { id?: string }): boolean {
    if (s.id) {
      setServices((xs) => xs.map((x) => (x.id === s.id ? ({ ...x, ...s } as Service) : x)));
      toast.success("Услугата е обновена.");
      return true;
    }
    if (full) {
      toast.error("Безплатният план е до 8 услуги. Изтрий една или мини на Pro.");
      return false;
    }
    setServices((xs) => [...xs, { ...s, id: `n${++seq}` } as Service]);
    toast.success(`„${s.name}“ е добавена.`);
    return true;
  }
  function removeService(id: string) {
    const s = services.find((x) => x.id === id);
    setServices((xs) => xs.filter((x) => x.id !== id));
    toast.success(s ? `„${s.name}“ е изтрита.` : "Услугата е изтрита.");
  }
  function addTemplate(t: Template, raw: string): boolean {
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
      catId: t.catId,
      description: "",
      templateId: t.id,
    });
  }

  return {
    pro,
    groups,
    boxes,
    boxOf,
    services,
    terms,
    setTerms,
    limit,
    used,
    full,
    setBox,
    setAllBoxes,
    saveService,
    removeService,
    addTemplate,
    openTemplates,
    servicesOf: (catId: number) => services.filter((s) => s.catId === catId),
  };
}

export type Demo = ReturnType<typeof useDemo>;

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
export function LimitLine({ demo, className = "" }: { demo: Demo; className?: string }) {
  if (demo.limit == null) return null;
  return (
    <p className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.95rem] ${demo.full ? "text-ink" : "text-ink-2"} ${className}`}>
      {demo.full && <Lock className="size-4 shrink-0 self-center" aria-hidden />}
      <span>
        <span className="numerals text-[1.35rem]">
          {demo.used} от {demo.limit}
        </span>{" "}
        <span className="font-semibold">услуги</span>
      </span>
      <span className="text-ink-3">{demo.full ? "Безплатният план е пълен." : "Цените на категориите не се броят."}</span>
      {demo.full && (
        <Link href="/tabla/plan" className="link font-bold">
          Виж Pro
        </Link>
      )}
    </p>
  );
}

/** Free plan: one quiet line about what Pro adds here. */
export function ProNote({ demo }: { demo: Demo }) {
  if (demo.pro) return null;
  return (
    <p className="flex items-start gap-2 text-sm text-ink-2">
      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        Колко вземат колегите в {CITY} се вижда в Pro.{" "}
        <Link href="/tabla/plan" className="link font-bold">
          Виж плановете
        </Link>
      </span>
    </p>
  );
}

/** Pro: what colleagues charge in this top category. */
export function GroupHint({ demo, group }: { demo: Demo; group: Group }) {
  if (!demo.pro) return null;
  const h = group.hint;
  return (
    <p className="mb-3 text-sm text-ink-2">
      Колегите {h.scope === "city" ? `в ${CITY}` : "в страната"} вземат{" "}
      <span className="numerals text-base">
        {h.hourly[0]}–{h.hourly[1]} €/ч
      </span>{" "}
      или{" "}
      <span className="numerals text-base">
        {h.job[0]}–{h.job[1]} €
      </span>{" "}
      на услуга. Само за ориентир.
    </p>
  );
}

/* ------------------------------------------------------------------------------------------------
 * The price of a category
 * ---------------------------------------------------------------------------------------------- */

const BOX_KINDS: { k: BoxKind; label: string }[] = [
  { k: "fixed", label: "Точна цена" },
  { k: "from", label: "От … €" },
  { k: "hour", label: "На час" },
  { k: "quote", label: "По оглед" },
];

const BOX_UNITS: { value: Unit; label: string }[] = [
  { value: "job", label: "за работа" },
  { value: "m2", label: "на м²" },
  { value: "piece", label: "на брой" },
  { value: "meter", label: "на линеен метър" },
  { value: "day", label: "на ден" },
];

const KIND_HINT: Record<BoxKind, string> = {
  fixed: "Една цена за обичайната работа в тази категория.",
  from: "Клиентите виждат „от …“. Точната сума казваш в чата.",
  hour: "Клиентите виждат цената на час. Работите „по оглед“ получават ориентировъчна сума от нея.",
  quote: "Клиентите виждат „по оглед“, без сума.",
};

/** Four kinds of price and, for a sum, the amount (and the unit for a fixed or „от“ price). */
export function PriceEditor({ box, onChange, idp }: { box: Box; onChange: (b: Box) => void; idp: string }) {
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
            className="chip"
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
              onChange={(e) => onChange({ ...box, unit: e.target.value as Unit })}
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
export function PriceTag({ box, className = "text-[1.7rem]" }: { box: Box; className?: string }) {
  const p = boxPrice(box);
  if (!p) return <span className="text-[0.95rem] font-semibold text-ink-2">без цена</span>;
  if (p === "по оглед") return <span className="text-[0.95rem] font-bold">по оглед</span>;
  return <span className={`numerals whitespace-nowrap leading-none ${className}`}>{p}</span>;
}

/* ------------------------------------------------------------------------------------------------
 * Services
 * ---------------------------------------------------------------------------------------------- */

const SVC_KINDS: { k: ServiceKind; label: string }[] = [
  { k: "fixed", label: "Точна цена" },
  { k: "from", label: "От … €" },
  { k: "quote", label: "По оглед" },
];

const SVC_UNITS: { value: Unit; label: string }[] = [
  { value: "job", label: "за услугата" },
  { value: "hour", label: "на час" },
  { value: "m2", label: "на м²" },
  { value: "piece", label: "на брой" },
  { value: "meter", label: "на линеен метър" },
  { value: "day", label: "на ден" },
];

/** One service as a strip: name, its note, the price, edit and delete. */
export function ServiceRow({
  s,
  onEdit,
  onDelete,
  className = "bg-surface",
}: {
  s: Service;
  onEdit: () => void;
  onDelete: () => void;
  className?: string;
}) {
  const quote = s.kind === "quote";
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[6px] py-2 pl-3 pr-1.5 ${className}`}>
      <div className="min-w-0 flex-1 py-1">
        <p className="font-bold leading-snug">{s.name}</p>
        {s.description && <p className="text-sm text-ink-3">{s.description}</p>}
      </div>
      <p className={quote ? "text-[0.95rem] font-semibold text-ink-2" : "numerals whitespace-nowrap text-2xl"}>{servicePrice(s)}</p>
      <div className="flex">
        <button type="button" className={`${st.act} btn-ghost`} onClick={onEdit} aria-label={`Промени „${s.name}“`}>
          <Pencil className="size-4" aria-hidden />
        </button>
        <button type="button" className={`${st.act} btn-ghost text-danger`} onClick={onDelete} aria-label={`Изтрий „${s.name}“`}>
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}

type Draft = { name: string; kind: ServiceKind; price: string; unit: Unit; description: string; catId: number; templateId?: number };

/** The service form, drawn where the button (or the row being changed) was. */
export function ServiceForm({
  demo,
  catId,
  editing,
  onDone,
  surface = "bg-paper",
}: {
  demo: Demo;
  catId: number;
  editing?: Service;
  onDone: () => void;
  surface?: string;
}) {
  const [d, setD] = useState<Draft>(
    editing
      ? { name: editing.name, kind: editing.kind, price: editing.price, unit: editing.unit, description: editing.description, catId: editing.catId, templateId: editing.templateId }
      : { name: "", kind: "fixed", price: "", unit: "job", description: "", catId },
  );
  const [errors, setErrors] = useState<{ name?: string; price?: string }>({});
  const idp = `svc-${editing?.id ?? `new-${catId}`}`;
  const box = demo.boxOf(catId);
  const range = d.templateId != null ? TEMPLATES.find((t) => t.id === d.templateId)?.range : undefined;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const err: typeof errors = {};
    if (d.name.trim().length < 2) err.name = "Напиши име на услугата.";
    if (d.kind !== "quote" && !isMoney(d.price)) err.price = d.price.trim() ? "Напиши цената с числа, например 35." : "Напиши цена или избери „По оглед“.";
    setErrors(err);
    if (err.name || err.price) return;
    const ok = demo.saveService({ ...d, name: d.name.trim(), price: d.kind === "quote" ? "" : d.price.trim(), description: d.description.trim(), id: editing?.id });
    if (ok) onDone();
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
          onChange={(e) => setD({ ...d, name: e.target.value, templateId: undefined })}
        />
        {errors.name && <p className="error-text">{errors.name}</p>}
      </div>
      <fieldset>
        <legend className="label">Цена</legend>
        <div className="flex flex-wrap gap-2">
          {SVC_KINDS.map(({ k, label }) => (
            <button key={k} type="button" className="chip" aria-pressed={d.kind === k} onClick={() => setD({ ...d, kind: k })}>
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
            <select className="field w-auto min-w-40" aria-label="Мерна единица" value={d.unit} onChange={(e) => setD({ ...d, unit: e.target.value as Unit })}>
              {SVC_UNITS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="hint">
            Клиентите виждат „по оглед“
            {(() => {
              const t = TEMPLATES.find((x) => x.id === d.templateId);
              const est = t ? estimate(box, t.hours) : null;
              return est ? ` и ориентировъчно ≈ ${est} € от цената ти на час.` : ".";
            })()}
          </p>
        )}
        {errors.price && <p className="error-text">{errors.price}</p>}
        {demo.pro && range && (
          <p className="hint">
            Колегите в {CITY} вземат {range[0]}–{range[1]} € за тази работа.
          </p>
        )}
      </fieldset>
      {editing && (
        <div>
          <label htmlFor={`${idp}-cat`} className="label">
            Категория
          </label>
          <select id={`${idp}-cat`} className="field" value={d.catId} onChange={(e) => setD({ ...d, catId: Number(e.target.value) })}>
            {demo.boxes.map((b) => (
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
        <button type="submit" className="btn btn-primary">
          {editing ? "Запази" : "Добави"}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Откажи
        </button>
      </div>
    </form>
  );
}

/** A ready-made job: write a price and add it. Empty = „по оглед“ (with „≈ X €“ when the box is per hour). */
export function SuggestionRow({ demo, t, className = "bg-surface" }: { demo: Demo; t: Template; className?: string }) {
  const [price, setPrice] = useState("");
  const est = estimate(demo.boxOf(t.catId), t.hours);
  const add = () => {
    if (demo.addTemplate(t, price)) setPrice("");
  };
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[6px] px-3 py-2 ${className}`}>
      <div className="min-w-0 flex-[1_1_14rem]">
        <p className="font-semibold leading-snug">{t.name}</p>
        <p className="text-sm text-ink-3">
          {price.trim() === "" ? (est ? `Без цена: по оглед, ≈ ${est} €` : "Без цена: по оглед") : "за работа"}
          {demo.pro && (
            <>
              {" · "}
              <span className="font-semibold text-ink-2">
                колегите вземат {t.range[0]}–{t.range[1]} €
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
                add();
              }
            }}
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 font-bold text-ink-3">€</span>
        </div>
        <button type="button" className="btn btn-outline btn-sm max-sm:min-h-11" disabled={demo.full} onClick={add}>
          <Plus className="size-4" aria-hidden /> Добави
        </button>
      </div>
    </li>
  );
}

/** „Добави услуга“, switched off with the reason when the free plan is full. */
export function AddServiceButton({ demo, onClick, label = "Добави услуга", className = "btn-outline" }: { demo: Demo; onClick: () => void; label?: string; className?: string }) {
  return (
    <button type="button" className={`btn ${className}`} disabled={demo.full} onClick={onClick} title={demo.full ? "Безплатният план е до 8 услуги" : undefined}>
      <Plus className="size-4" aria-hidden /> {label}
    </button>
  );
}

/** In place of „Добави услуга“ when the free plan is full: the reason and the way out, right where the button was. */
export function FullNote({ demo }: { demo: Demo }) {
  return (
    <p className="flex items-start gap-2 rounded-[6px] bg-paper px-3 py-2.5 text-[0.95rem] text-ink">
      <Lock className="mt-1 size-4 shrink-0" aria-hidden />
      <span>
        Планът е пълен:{" "}
        <span className="font-semibold">
          {demo.used} от {demo.limit} услуги
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

const POLICIES: { value: Policy; label: string; hint: string }[] = [
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

/** The fields of the terms block. `rowClass` is the strip colour of the radio and tick rows. */
export function TermsFields({ terms, onChange, idp, rowClass = "bg-paper" }: { terms: Terms; onChange: (t: Terms) => void; idp: string; rowClass?: string }) {
  const paid = terms.policy === "paid" || terms.policy === "deducted";
  const set = (patch: Partial<Terms>) => onChange({ ...terms, ...patch });
  const row = `flex cursor-pointer items-start gap-3 rounded-[6px] px-3 py-3 transition-colors motion-reduce:transition-none has-[:checked]:bg-rule-soft ${rowClass}`;
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
export function SaveBarProto({ onSave, onCancel, text = "Имаш незаписани промени" }: { onSave: () => void; onCancel: () => void; text?: string }) {
  return (
    <div
      role="region"
      aria-label="Незаписани промени"
      className="save-bar-in fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 mx-auto flex max-w-xl flex-wrap items-center gap-1.5 rounded-[10px] bg-ink p-2 pl-4 text-white shadow-[var(--shadow-lg)] lg:bottom-5 lg:left-[calc(max((100vw-80rem)/2,0px)+18rem)] lg:right-auto lg:mx-0 lg:w-[36rem]"
    >
      <p className="flex-1 text-[0.95rem] font-semibold leading-tight">{text}</p>
      <button type="button" className="btn text-white hover:bg-white/10" onClick={onCancel}>
        Отказ
      </button>
      <button type="button" className="btn btn-rule" onClick={onSave}>
        Запази
      </button>
    </div>
  );
}
