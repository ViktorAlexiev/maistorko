"use client";

import { useActionState, useState } from "react";
import { updatePricing } from "@/app/actions/dashboard";
import type { FormState } from "@/app/actions/auth";
import { FieldError, FormMessage, SubmitButton } from "@/components/submit-button";

export type Initial = {
  hourlyRate: string;
  calloutFee: string;
  travelFee: string;
  materialsIncluded: boolean;
  quoteOnInspection: boolean;
  inspectionPolicy: "" | "free" | "paid" | "deducted" | "none";
  inspectionFee: string;
  termsNote: string;
};

const POLICIES: { value: Initial["inspectionPolicy"]; label: string; hint: string }[] = [
  { value: "free", label: "Безплатен оглед", hint: "Идвам да видя обекта без заплащане." },
  { value: "paid", label: "Платен оглед", hint: "Огледът се плаща отделно." },
  { value: "deducted", label: "Платен, приспада се", hint: "Плаща се, но се приспада от цената, ако работата ми се възложи." },
  { value: "none", label: "Без оглед", hint: "Идвам направо за работа; цената се уточнява в чата." },
];

export function PricingForm({ initial }: { initial: Initial }) {
  const [state, action] = useActionState<FormState, FormData>(updatePricing, {});
  const v = { ...initial, ...state.values };
  const [policy, setPolicy] = useState<Initial["inspectionPolicy"]>(initial.inspectionPolicy);
  const paid = policy === "paid" || policy === "deducted";

  const money = (name: "hourlyRate" | "calloutFee" | "travelFee" | "inspectionFee", label: string, hint: string, suffix = "€") => (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          inputMode="decimal"
          className="field pr-12"
          defaultValue={v[name] as string}
          aria-invalid={Boolean(state.errors?.[name])}
          aria-describedby={`${name}-hint${state.errors?.[name] ? ` ${name}-err` : ""}`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-bold text-ink-3">{suffix}</span>
      </div>
      <p id={`${name}-hint`} className="hint">
        {hint}
      </p>
      <FieldError id={`${name}-err`} message={state.errors?.[name]} />
    </div>
  );

  return (
    <section aria-labelledby="base-heading">
      <h2 id="base-heading" className="display text-4xl">
        Основни цени
      </h2>
      <form action={action} className="mt-4 grid gap-5 rounded-[10px] border border-line bg-surface p-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-3">
          {money("hourlyRate", "Цена на час", "По желание. Показва се като „от X €/ч“.", "€/ч")}
          {money("calloutFee", "Такса посещение", "По желание. Минимална сума за идване.")}
          {money("travelFee", "Транспорт извън града", "По желание.")}
        </div>
        <div className="grid gap-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" name="materialsIncluded" className="check mt-0.5" defaultChecked={initial.materialsIncluded} />
            <span>
              <span className="font-bold">Материалите са включени в цената</span>
              <span className="block text-sm text-ink-2">Иначе показваме „материалите се заплащат отделно“.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" name="quoteOnInspection" className="check mt-0.5" defaultChecked={initial.quoteOnInspection} />
            <span>
              <span className="font-bold">По-големите обекти са с цена след оглед</span>
              <span className="block text-sm text-ink-2">Ако нямаш никакви цени, в търсенето пише „по оглед“.</span>
            </span>
          </label>
        </div>
        <fieldset className="grid gap-3 border-t border-line pt-5">
          <legend className="mb-1 text-lg font-extrabold">Оглед</legend>
          <p className="-mt-1 text-sm text-ink-2">
            Клиентите виждат това до цените, за да знаят дали първото идване е за оглед и колко струва.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {POLICIES.map((p) => (
              <label
                key={p.value}
                className={`flex cursor-pointer gap-3 rounded-[8px] border-[1.5px] p-3 transition-colors ${
                  policy === p.value ? "border-ink bg-rule-soft" : "border-line-strong bg-surface hover:border-ink"
                }`}
              >
                <input
                  type="radio"
                  name="inspectionPolicy"
                  value={p.value}
                  checked={policy === p.value}
                  onChange={() => setPolicy(p.value)}
                  className="check mt-0.5"
                />
                <span>
                  <span className="block font-bold">{p.label}</span>
                  <span className="block text-sm text-ink-2">{p.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {policy === "" && <input type="hidden" name="inspectionPolicy" value="" />}
          {paid && (
            <div className="max-w-xs">{money("inspectionFee", "Цена на огледа", "Например 20 или 30.")}</div>
          )}
        </fieldset>

        <div className="border-t border-line pt-5">
          <label htmlFor="termsNote" className="label text-lg font-extrabold">
            Как работя <span className="text-sm font-normal text-ink-3">(по желание)</span>
          </label>
          <textarea
            id="termsNote"
            name="termsNote"
            rows={3}
            maxLength={600}
            className="field"
            defaultValue={v.termsNote as string}
            placeholder="напр. Малките ремонти правя направо. За бани и ремонти на цели помещения първо идвам на оглед и давам писмена оферта."
            aria-invalid={Boolean(state.errors?.termsNote)}
          />
          <p className="hint">Показва се под цените в профила ти.</p>
          <FieldError id="termsNote-err" message={state.errors?.termsNote} />
        </div>

        <FormMessage state={state} />
        <div>
          <SubmitButton pendingText="Записваме…">Запази цените</SubmitButton>
        </div>
      </form>
    </section>
  );
}
