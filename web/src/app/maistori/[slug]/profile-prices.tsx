import { Check, Info } from "lucide-react";
import { formatEur, servicePrice, UNIT_SHORT, type PriceKind, type PriceUnit } from "@/lib/format";
import { priceText, type BoxKind } from "@/lib/prices";

export type ProfileService = {
  id: string;
  name: string;
  description: string | null;
  kind: PriceKind;
  price: number | null;
  unit: PriceUnit;
  /** „≈ X €“ for a ready-made job left „по оглед“ whose box is priced per hour */
  estimate: number | null;
  /** usual price range (indicative) for a ready-made job */
  range: { p25: number; p75: number; scope: string } | null;
};

export type ProfileBox = {
  id: number;
  name: string;
  kind: BoxKind | null;
  price: number | null;
  unit: PriceUnit;
  services: ProfileService[];
};

export type ProfileGroup = { id: number; name: string; boxes: ProfileBox[] };

type Terms = {
  callout: number | null;
  travel: number | null;
  materials: boolean;
  quoteOnInspection: boolean;
  policy: string | null;
  inspectionFee: number | null;
  note: string | null;
};

function Intro() {
  return (
    <p className="mt-2 flex max-w-[68ch] items-start gap-2 text-ink-2">
      <Info className="mt-1 size-4 shrink-0" aria-hidden />
      Цените са ориентировъчни. Точната цена се уговаря в чата, а за по-големи работи обикновено първо има оглед.
    </p>
  );
}

/** A box's price as clients see it. A box without a price shows nothing. */
function BoxPrice({ box, className = "text-[1.7rem]" }: { box: ProfileBox; className?: string }) {
  const p = priceText(box.kind, box.price, box.unit);
  if (!p) return null;
  if (p === "по оглед") return <span className="whitespace-nowrap text-[0.95rem] font-bold">по оглед</span>;
  return <span className={`numerals whitespace-nowrap leading-none ${className}`}>{p}</span>;
}

/** One service: name, its note, the usual range for a ready-made job, the price (and „≈ X €“ for one left „по оглед“). */
function ServiceLine({ s, cityName }: { s: ProfileService; cityName: string | null }) {
  const quote = s.kind === "quote";
  return (
    <li className="flex items-start justify-between gap-4 rounded-[6px] bg-surface px-4 py-3">
      <div className="min-w-0">
        <p className="font-semibold leading-snug">{s.name}</p>
        {s.description && <p className="text-sm text-ink-3">{s.description}</p>}
        {s.estimate != null && (
          <p className="text-sm font-semibold text-ink-2">
            ≈ {s.estimate} €{UNIT_SHORT[s.unit]}, ориентировъчно
          </p>
        )}
        {s.range && (
          <p className="text-sm text-ink-3">
            Обикновено {s.range.scope === "city" && cityName ? `в ${cityName}` : "в България"}: {s.range.p25}–{s.range.p75} €
            {UNIT_SHORT[s.unit]} (ориентировъчно)
          </p>
        )}
      </div>
      <p className={`shrink-0 text-right ${quote ? "pt-0.5 font-semibold text-ink-2" : "numerals whitespace-nowrap text-2xl leading-tight"}`}>
        {servicePrice(s.kind, s.price, s.unit)}
      </p>
    </li>
  );
}

function inspectionText(policy: string | null, fee: number | null) {
  const eur = fee != null ? formatEur(fee) : "";
  switch (policy) {
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
function TermsView({ terms }: { terms: Terms }) {
  const rows: { label: string; value: React.ReactNode; hint?: string }[] = [];
  if (terms.callout != null)
    rows.push({ label: "Посещение за работа", value: `${formatEur(terms.callout)} минимум`, hint: "Ако работата излезе по-евтино, плащате тази сума." });
  rows.push({
    label: "Оглед",
    value: inspectionText(terms.policy, terms.inspectionFee),
    hint: terms.policy && terms.policy !== "none" ? "Отделно идване, само за да види обекта и да каже цена." : undefined,
  });
  if (terms.quoteOnInspection) rows.push({ label: "По-големи обекти", value: "Цена след оглед" });
  if (terms.travel != null) rows.push({ label: "Транспорт извън града", value: formatEur(terms.travel) });
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
        <div key={r.label} className="grid gap-0.5 rounded-[6px] bg-surface px-4 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
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

function Note({ note, firstName }: { note: string | null; firstName: string }) {
  if (!note?.trim()) return null;
  return (
    <figure className="rounded-[8px] bg-paper p-4">
      <blockquote className="max-w-[68ch] whitespace-pre-line text-ink-2">{note}</blockquote>
      <figcaption className="mt-2 text-sm text-ink-3">{firstName} за начина си на работа</figcaption>
    </figure>
  );
}

/** The „Цени“ section of the public profile: a box per ticked subcategory (price and services), the terms, the craftsman's note. */
export function ProfilePrices({
  groups,
  showGroupNames,
  firstName,
  cityName,
  terms,
}: {
  groups: ProfileGroup[];
  showGroupNames: boolean;
  firstName: string;
  cityName: string | null;
  terms: Terms;
}) {
  const H = showGroupNames ? "h4" : "h3";
  return (
    <section id="tseni" aria-labelledby="price-heading">
      <h2 id="price-heading" className="display text-4xl">
        Цени
      </h2>
      <Intro />
      <div className="mt-6 grid gap-8">
        {groups.length === 0 && <p className="mt-3 text-ink-2">Питайте {firstName} за цена в чата.</p>}
        {groups.map((g) => (
          <div key={g.id}>
            {showGroupNames && <h3 className="display mb-2 text-[1.7rem]">{g.name}</h3>}
            <div className="grid gap-4">
              {g.boxes.map((b) => (
                <article key={b.id} aria-labelledby={`pk-${b.id}`} className="overflow-hidden rounded-[10px] bg-surface">
                  <div className="flex items-center justify-between gap-3 bg-rule px-5 py-2.5">
                    <H id={`pk-${b.id}`} className="display text-3xl">
                      {b.name}
                    </H>
                    <BoxPrice box={b} className="text-[1.9rem]" />
                  </div>
                  {b.services.length > 0 && (
                    <div className="p-4 sm:p-5">
                      <ul className="grid gap-1 rounded-[8px] bg-paper p-1.5">
                        {b.services.map((s) => (
                          <ServiceLine key={s.id} s={s} cityName={cityName} />
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
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
              <TermsView terms={terms} />
            </div>
            <Note note={terms.note} firstName={firstName} />
          </div>
        </article>
      </div>
    </section>
  );
}
