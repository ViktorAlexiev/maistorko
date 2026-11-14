"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { Box, Terms } from "./data";
import {
  AddServiceButton,
  FullNote,
  GroupHint,
  LimitLine,
  PageHead,
  PriceEditor,
  PriceTag,
  ProNote,
  SaveBarProto,
  ServiceForm,
  ServiceRow,
  SuggestionRow,
  TermsFields,
  st,
  useDemo,
  type Demo,
} from "./shared";

/**
 * „Кутии“: everything open on one page. One box per checked subcategory under a yellow band that shows the price as
 * clients see it; the services and the ready-made jobs sit inside the box. Category prices and terms are saved together
 * with the dark bar (as on „Профил“); a service is saved at once with its own button.
 */
export function VariantKutii({ pro, full = false }: { pro: boolean; full?: boolean }) {
  const demo = useDemo(pro, full);
  const [saved, setSaved] = useState<{ boxes: Box[]; terms: Terms }>({ boxes: demo.boxes, terms: demo.terms });
  const [form, setForm] = useState<{ catId: number; id?: string } | null>(null);

  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const boxDirty = (b: Box) => !same(b, saved.boxes.find((x) => x.id === b.id));
  const termsDirty = !same(demo.terms, saved.terms);
  const dirty = demo.boxes.some(boxDirty) || termsDirty;

  function save() {
    const missing = demo.boxes.find((b) => b.kind && b.kind !== "quote" && !/^\d+([.,]\d{1,2})?$/.test(b.price.trim()));
    if (missing) return void toast.error(`Напиши цена в „${missing.name}“ или избери „По оглед“.`);
    setSaved({ boxes: demo.boxes, terms: demo.terms });
    toast.success("Цените са записани.");
  }
  function cancel() {
    demo.setAllBoxes(saved.boxes);
    demo.setTerms(saved.terms);
  }

  return (
    <div className={dirty ? "pb-24" : ""}>
      <PageHead>
        <div className="mt-4 grid gap-1.5">
          <LimitLine demo={demo} />
          <ProNote demo={demo} />
        </div>
      </PageHead>

      <div className="mt-10 grid max-w-3xl gap-10">
        {demo.groups.map((g) => (
          <section key={g.name} aria-label={g.name}>
            <h2 className={st.group}>{g.name}</h2>
            <GroupHint demo={demo} group={g} />
            <div className="grid gap-4">
              {g.boxes.map((b) => (
                <BoxCard key={b.id} demo={demo} box={b} dirty={boxDirty(b)} form={form} setForm={setForm} />
              ))}
            </div>
          </section>
        ))}

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
            <TermsFields terms={demo.terms} onChange={demo.setTerms} idp="k-terms" />
          </div>
        </section>
      </div>

      {dirty && <SaveBarProto onSave={save} onCancel={cancel} />}
    </div>
  );
}

function Rivet() {
  return <span className={`${st.rivet} absolute -right-3.5 top-1`} role="img" aria-label="има незаписани промени" />;
}

function BoxCard({
  demo,
  box,
  dirty,
  form,
  setForm,
}: {
  demo: Demo;
  box: Box;
  dirty: boolean;
  form: { catId: number; id?: string } | null;
  setForm: (f: { catId: number; id?: string } | null) => void;
}) {
  const svcs = demo.servicesOf(box.id);
  const tpls = demo.openTemplates(box.id);
  const adding = form?.catId === box.id && !form.id;
  return (
    <article aria-labelledby={`k-b-${box.id}`} className={st.shell}>
      <div className={st.head}>
        {/* the rivet sits beside the heading, not in it, so the heading's name stays the category's name */}
        <div className="relative min-w-0">
          <h3 id={`k-b-${box.id}`} className={st.title}>
            {box.name}
          </h3>
          {dirty && <Rivet />}
        </div>
        <PriceTag box={box} className="text-[1.9rem]" />
      </div>
      <div className={st.body}>
        <PriceEditor box={box} onChange={(b) => demo.setBox(box.id, b)} idp={`k-${box.id}`} />

        <div>
          <h4 className={st.groupSm}>
            Услуги <span className="font-sans text-sm font-normal text-ink-3">(по желание)</span>
          </h4>
          {svcs.length > 0 && (
            <ul className={st.panel}>
              {svcs.map((s) =>
                form?.id === s.id ? (
                  <li key={s.id}>
                    <ServiceForm demo={demo} catId={box.id} editing={s} onDone={() => setForm(null)} surface="bg-surface" />
                  </li>
                ) : (
                  <ServiceRow key={s.id} s={s} onEdit={() => setForm({ catId: box.id, id: s.id })} onDelete={() => demo.removeService(s.id)} />
                ),
              )}
            </ul>
          )}
          <div className={svcs.length > 0 ? "mt-3" : ""}>
            {adding ? (
              <ServiceForm demo={demo} catId={box.id} onDone={() => setForm(null)} />
            ) : demo.full ? (
              <FullNote demo={demo} />
            ) : (
              <AddServiceButton demo={demo} onClick={() => setForm({ catId: box.id })} />
            )}
          </div>
        </div>

        {tpls.length > 0 && (
          <div>
            <h4 className={st.groupSm}>Готови работи</h4>
            <p className="-mt-1 mb-2 text-sm text-ink-2">Напиши цена и натисни „Добави“. Без цена работата излиза „по оглед“.</p>
            <ul className={st.panel}>
              {tpls.map((t) => (
                <SuggestionRow key={t.id} demo={demo} t={t} />
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}
