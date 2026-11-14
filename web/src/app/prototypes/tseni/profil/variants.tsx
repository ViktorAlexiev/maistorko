"use client";

import { Check, Info } from "lucide-react";
import { formatEur } from "@/lib/format";
import { TEMPLATES, type Box, type Group, type Service, type Terms } from "../data";
import { boxPrice, estimate, servicePrice } from "../shared";
import { PERSON, type ProfileData } from "./profil-data";

/* ------------------------------------------------------------------------------------------------
 * Pieces of the section: the intro line, one service, the terms, the craftsman's note.
 * ---------------------------------------------------------------------------------------------- */

function Intro() {
  return (
    <p className="mt-2 flex max-w-[68ch] items-start gap-2 text-ink-2">
      <Info className="mt-1 size-4 shrink-0" aria-hidden />
      Цените са ориентировъчни. Точната цена се уговаря в чата, а за по-големи работи обикновено първо има оглед.
    </p>
  );
}

/** A box's price as clients see it. A box without a price shows nothing. */
function BoxPrice({ box, className = "text-[1.7rem]" }: { box: Box; className?: string }) {
  const p = boxPrice(box);
  if (!p) return null;
  if (p === "по оглед") return <span className="whitespace-nowrap text-[0.95rem] font-bold">по оглед</span>;
  return <span className={`numerals whitespace-nowrap leading-none ${className}`}>{p}</span>;
}

/** One service: name, its note, the usual range for a ready-made job, the price (and „≈ X €“ for one left „по оглед“). */
function ServiceLine({ s, box, className = "bg-surface" }: { s: Service; box: Box | undefined; className?: string }) {
  const tpl = s.templateId != null ? TEMPLATES.find((t) => t.id === s.templateId) : undefined;
  const est = s.kind === "quote" && tpl ? estimate(box, tpl.hours) : null;
  const quote = s.kind === "quote";
  return (
    <li className={`flex items-start justify-between gap-4 rounded-[6px] px-4 py-3 ${className}`}>
      <div className="min-w-0">
        <p className="font-semibold leading-snug">{s.name}</p>
        {s.description && <p className="text-sm text-ink-3">{s.description}</p>}
        {est && <p className="text-sm font-semibold text-ink-2">≈ {est} €, ориентировъчно</p>}
        {tpl && (
          <p className="text-sm text-ink-3">
            Обикновено в {PERSON.city}: {tpl.range[0]}–{tpl.range[1]} € (ориентировъчно)
          </p>
        )}
      </div>
      <p className={`shrink-0 text-right ${quote ? "pt-0.5 font-semibold text-ink-2" : "numerals whitespace-nowrap text-2xl leading-tight"}`}>{servicePrice(s)}</p>
    </li>
  );
}

function inspectionText(t: Terms) {
  const eur = t.inspectionFee.trim() ? formatEur(t.inspectionFee) : "";
  switch (t.policy) {
    case "free":
      return "Безплатен";
    case "paid":
      return eur ? `${eur}, плаща се отделно` : "Платен, цената се уточнява в чата";
    case "deducted":
      return eur ? `${eur}, приспада се от цената, ако работата се възложи` : "Платен, приспада се от цената, ако работата се възложи";
    case "none":
      return "Без оглед: идва направо за работа";
    default:
      return "Уточнява се в чата";
  }
}

/** The terms as strips: label on the left (on top on a phone), the value and what it means on the right. */
function TermsView({ terms, rowClass = "bg-surface" }: { terms: Terms; rowClass?: string }) {
  const rows: { label: string; value: React.ReactNode; hint?: string }[] = [];
  if (terms.callout.trim())
    rows.push({ label: "Посещение за работа", value: `${formatEur(terms.callout)} минимум`, hint: "Ако работата излезе по-евтино, плащате тази сума." });
  rows.push({
    label: "Оглед",
    value: inspectionText(terms),
    hint: terms.policy && terms.policy !== "none" ? "Отделно идване, само за да види обекта и да каже цена." : undefined,
  });
  if (terms.quoteOnInspection) rows.push({ label: "По-големи обекти", value: "Цена след оглед" });
  if (terms.travel.trim()) rows.push({ label: "Транспорт извън града", value: formatEur(terms.travel) });
  rows.push({
    label: "Материали",
    value: terms.materials ? (
      <span className="inline-flex items-center gap-1.5">
        <Check className="size-4 text-free" aria-hidden /> Включени в цената
      </span>
    ) : (
      "Заплащат се отделно"
    ),
  });
  return (
    <dl className="grid gap-1 text-[0.95rem]">
      {rows.map((r) => (
        <div key={r.label} className={`grid gap-0.5 rounded-[6px] px-4 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4 ${rowClass}`}>
          <dt className="text-ink-3">{r.label}</dt>
          <dd>
            <span className="font-semibold">{r.value}</span>
            {r.hint && <span className="block text-sm text-ink-3">{r.hint}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Note({ terms, className = "bg-surface" }: { terms: Terms; className?: string }) {
  if (!terms.note.trim()) return null;
  return (
    <figure className={`rounded-[8px] p-4 ${className}`}>
      <blockquote className="max-w-[68ch] whitespace-pre-line text-ink-2">{terms.note}</blockquote>
      <figcaption className="mt-2 text-sm text-ink-3">{PERSON.firstName} за начина си на работа</figcaption>
    </figure>
  );
}

const servicesOf = (d: ProfileData, b: Box) => d.services.filter((s) => s.catId === b.id);

/** The top category's name only when there is more than one (the header already names a single one). Approved. */
function GroupName({ g, show, className }: { g: Group; show: boolean; className: string }) {
  if (!show) return null;
  return <h3 className={className}>{g.name}</h3>;
}

/* ------------------------------------------------------------------------------------------------
 * „Кутии“ (approved 14 Nov 2026): the same boxes the craftsman fills in, a yellow band with the name and the price,
 * the services inside.
 * ---------------------------------------------------------------------------------------------- */

export function VariantKutii({ d }: { d: ProfileData }) {
  const showGroup = d.groups.length > 1;
  const H = showGroup ? "h4" : "h3";
  return (
    <section id="tseni" aria-labelledby="price-heading">
      <h2 id="price-heading" className="display text-4xl">
        Цени
      </h2>
      <Intro />
      <div className="mt-6 grid gap-8">
        {d.groups.map((g) => (
          <div key={g.name}>
            <GroupName g={g} show={showGroup} className="display mb-2 text-[1.7rem]" />
            <div className="grid gap-4">
              {g.boxes.map((b) => {
                const svcs = servicesOf(d, b);
                return (
                  <article key={b.id} aria-labelledby={`pk-${b.id}`} className="overflow-hidden rounded-[10px] bg-surface">
                    <div className="flex items-center justify-between gap-3 bg-rule px-5 py-2.5">
                      <H id={`pk-${b.id}`} className="display text-3xl">
                        {b.name}
                      </H>
                      <BoxPrice box={b} className="text-[1.9rem]" />
                    </div>
                    {svcs.length > 0 && (
                      <div className="p-4 sm:p-5">
                        <ul className="grid gap-1 rounded-[8px] bg-paper p-1.5">
                          {svcs.map((s) => (
                            <ServiceLine key={s.id} s={s} box={b} />
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        ))}
        <article aria-labelledby="pk-terms" className="overflow-hidden rounded-[10px] bg-surface">
          <div className="bg-rule px-5 py-2.5">
            <h3 id="pk-terms" className="display text-3xl">
              Условия
            </h3>
          </div>
          <div className="grid gap-4 p-4 sm:p-5">
            <div className="rounded-[8px] bg-paper p-1.5">
              <TermsView terms={d.terms} />
            </div>
            <Note terms={d.terms} className="bg-paper" />
          </div>
        </article>
      </div>
    </section>
  );
}
