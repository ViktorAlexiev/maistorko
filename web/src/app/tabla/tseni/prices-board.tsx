"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { savePrices, type TermsInput } from "@/app/actions/dashboard";
import { toMoney } from "@/lib/validation";
import type { PriceUnit } from "@/lib/format";
import type { BoxKind } from "@/lib/prices";
import { GroupHint, LimitLine, PageHead, PriceEditor, PriceTag, ProNote, SaveBar, TermsFields, st } from "./price-parts";

export type BoardBox = { id: number; name: string; kind: BoxKind | null; price: string; unit: PriceUnit }; // id = id на подкатегорията
export type BoardHint = { hourly: [number, number] | null; job: [number, number] | null; scope: "city" | "all" };
export type BoardGroup = { id: number; name: string; boxes: BoardBox[]; hint: BoardHint | null };

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * „Кутии“: one box per checked subcategory under a yellow band that shows the price as clients see it. Category prices
 * and terms are saved together with the dark bar (as on „Профил“).
 */
export function PricesBoard({
  groups,
  terms: initialTerms,
  cityName,
  proHints,
  limit,
  used,
  children,
}: {
  groups: BoardGroup[];
  terms: TermsInput;
  cityName: string | null;
  proHints: boolean;
  limit: number | null;
  used: number;
  children?: React.ReactNode; // temporary: the old ServicesEditor and TemplatePicker under „Условия“
}) {
  const router = useRouter();
  const initialBoxes = groups.flatMap((g) => g.boxes);
  const [boxes, setBoxes] = useState<BoardBox[]>(initialBoxes);
  const [terms, setTerms] = useState<TermsInput>(initialTerms);
  const [saved, setSaved] = useState<{ boxes: BoardBox[]; terms: TermsInput }>({ boxes: initialBoxes, terms: initialTerms });
  const [pending, setPending] = useState(false);

  const boxOf = (id: number) => boxes.find((b) => b.id === id);
  const boxDirty = (b: BoardBox) => !same(b, saved.boxes.find((x) => x.id === b.id));
  const termsDirty = !same(terms, saved.terms);
  const dirty = boxes.some(boxDirty) || termsDirty;

  function setBox(id: number, next: BoardBox) {
    setBoxes((bs) => bs.map((b) => (b.id === id ? next : b)));
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
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
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

        {children}
      </div>

      {dirty && <SaveBar onSave={save} onCancel={cancel} pending={pending} />}
    </div>
  );
}

function Rivet() {
  return <span className={`${st.rivet} absolute -right-3.5 top-1`} role="img" aria-label="има незаписани промени" />;
}
