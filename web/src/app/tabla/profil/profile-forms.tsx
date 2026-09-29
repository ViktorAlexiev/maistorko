"use client";

import { useActionState, useState } from "react";
import { updateClientProfile, updateCraftsmanProfile } from "@/app/actions/dashboard";
import type { FormState } from "@/app/actions/auth";
import { FieldError, FormMessage, SubmitButton } from "@/components/submit-button";
import { CategoryIcon } from "@/components/category-icon";
import { LANGUAGE_LABEL } from "@/lib/format";

type City = { id: number; slug: string; name: string; region: string; is_major: boolean };
type Tree = { id: number; slug: string; name: string; icon: string | null; children: { id: number; slug: string; name: string }[] }[];

/** Picking one of these reveals a free-text field: what exactly the "other" work is. */
type PhoneVisibility = "public" | "login" | "chat" | "hidden";
const PHONE_OPTIONS: { value: PhoneVisibility; label: string; hint: string }[] = [
  { value: "login", label: "На всеки влязъл потребител", hint: "Препоръчано. Номерът не се вижда от ботове и от хора без профил." },
  { value: "public", label: "На всеки", hint: "Бутон „Покажи телефона“ в профила ти, и без вход." },
  { value: "chat", label: "Само след като отговоря в чата", hint: "Първо се пише в чата, после клиентът вижда номера." },
  { value: "hidden", label: "На никого", hint: "Клиентите се свързват с теб само през чата." },
];

const OTHER_SLUGS = new Set(["drugo", "drugi-uslugi"]);

function CitySelect({ id, name, value, cities, invalid }: { id: string; name: string; value: string; cities: City[]; invalid?: boolean }) {
  const regions = Array.from(new Set(cities.map((c) => c.region)));
  return (
    <select id={id} name={name} className="field" defaultValue={value} aria-invalid={invalid}>
      <option value="">Изберете град</option>
      {regions.map((r) => (
        <optgroup key={r} label={`Област ${r}`}>
          {cities
            .filter((c) => c.region === r)
            .map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

export function ClientProfileForm({
  email,
  cities,
  initial,
}: {
  email: string;
  cities: City[];
  initial: { fullName: string; city: string; phone: string };
}) {
  const [state, action] = useActionState<FormState, FormData>(updateClientProfile, {});
  const v = { ...initial, ...state.values };
  return (
    <form action={action} className="grid gap-5 rounded-[10px] border border-line bg-surface p-5" noValidate>
      <div>
        <p className="label">Имейл</p>
        <p className="text-ink-2">{email}</p>
      </div>
      <div>
        <label htmlFor="fullName" className="label">
          Име
        </label>
        <input id="fullName" name="fullName" className="field" defaultValue={v.fullName} aria-invalid={Boolean(state.errors?.fullName)} />
        <FieldError id="fullName-err" message={state.errors?.fullName} />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className="label">
            Град
          </label>
          <CitySelect id="city" name="city" value={v.city} cities={cities} />
        </div>
        <div>
          <label htmlFor="phone" className="label">
            Телефон <span className="font-normal text-ink-3">(по желание)</span>
          </label>
          <input id="phone" name="phone" type="tel" inputMode="tel" className="field" defaultValue={v.phone} aria-invalid={Boolean(state.errors?.phone)} />
          <p className="hint">Не се показва на никого. Можете сами да го напишете в чата.</p>
          <FieldError id="phone-err" message={state.errors?.phone} />
        </div>
      </div>
      <FormMessage state={state} />
      <div>
        <SubmitButton pendingText="Записваме…">Запази</SubmitButton>
      </div>
    </form>
  );
}

type CraftInitial = {
  displayName: string;
  businessName: string;
  bio: string;
  years: string;
  city: string;
  areas: string[];
  categories: string[];
  languages: string[];
  contactHours: string;
  otherServices: string;
  phone: string;
  phoneVisibility: PhoneVisibility;
};

export function CraftsmanProfileForm({
  email,
  cities,
  tree,
  initial,
}: {
  email: string;
  cities: City[];
  tree: Tree;
  initial: CraftInitial;
}) {
  const [state, action] = useActionState<FormState, FormData>(updateCraftsmanProfile, {});
  const v = { ...initial, ...state.values } as CraftInitial;
  const [picked, setPicked] = useState(new Set(initial.categories));
  const [bioLen, setBioLen] = useState(initial.bio.length);
  const regions = Array.from(new Set(cities.map((c) => c.region)));
  const otherIds = new Set(
    tree.flatMap((t) => [t, ...t.children]).filter((c) => OTHER_SLUGS.has(c.slug)).map((c) => String(c.id)),
  );
  const otherPicked = [...picked].some((id) => otherIds.has(id));

  return (
    <form action={action} className="grid gap-10" noValidate>
      <section className="grid gap-5 rounded-[10px] border border-line bg-surface p-5" aria-labelledby="basics">
        <h2 id="basics" className="text-xl font-extrabold">
          Основни данни
        </h2>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="displayName" className="label">
              Име
            </label>
            <input
              id="displayName"
              name="displayName"
              className="field"
              defaultValue={v.displayName}
              aria-invalid={Boolean(state.errors?.displayName)}
              aria-describedby={state.errors?.displayName ? "displayName-err" : undefined}
            />
            <FieldError id="displayName-err" message={state.errors?.displayName} />
          </div>
          <div>
            <label htmlFor="businessName" className="label">
              Фирма <span className="font-normal text-ink-3">(по желание)</span>
            </label>
            <input id="businessName" name="businessName" className="field" defaultValue={v.businessName} />
          </div>
        </div>
        <div>
          <label htmlFor="bio" className="label">
            За теб
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={5}
            maxLength={1500}
            className="field"
            defaultValue={v.bio}
            onChange={(e) => setBioLen(e.target.value.length)}
            placeholder="С какво се занимаваш, от колко години, с какво си по-добър от другите. Пиши като на клиент."
            aria-describedby="bio-hint"
            aria-invalid={Boolean(state.errors?.bio)}
          />
          <p id="bio-hint" className="hint flex justify-between">
            <span>Няколко изречения са достатъчни.</span>
            <span className="tabular">{bioLen}/1500</span>
          </p>
          <FieldError id="bio-err" message={state.errors?.bio} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="years" className="label">
              Години опит
            </label>
            <input id="years" name="years" inputMode="numeric" className="field" defaultValue={v.years} aria-invalid={Boolean(state.errors?.years)} />
            <FieldError id="years-err" message={state.errors?.years} />
          </div>
          <div>
            <label htmlFor="contactHours" className="label">
              Кога отговаряш <span className="font-normal text-ink-3">(по желание)</span>
            </label>
            <input id="contactHours" name="contactHours" className="field" maxLength={80} defaultValue={v.contactHours} placeholder="напр. вечер след 18 ч." />
          </div>
        </div>
        <fieldset>
          <legend className="label">Езици</legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(LANGUAGE_LABEL).map(([code, label]) => (
              <label key={code} className="chip">
                <input type="checkbox" name="languages" value={code} defaultChecked={v.languages.includes(code)} className="sr-only" />
                {label}
              </label>
            ))}
          </div>
          <FieldError id="languages-err" message={state.errors?.languages} />
        </fieldset>
      </section>

      <section className="grid gap-4" aria-labelledby="cats">
        <div>
          <h2 id="cats" className="display text-4xl">
            Какво работиш
          </h2>
          <p className="text-ink-2">
            Избери конкретните услуги. Показваш се в търсенето по тях.{" "}
            <span className="numerals text-lg">{picked.size}</span> избрани.
          </p>
          <FieldError id="categories-err" message={state.errors?.categories} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {tree.map((top) => {
            const count = top.children.filter((c) => picked.has(String(c.id))).length + (picked.has(String(top.id)) ? 1 : 0);
            return (
              <details key={top.id} className="group rounded-[10px] border border-line bg-surface open:border-ink" open={count > 0}>
                <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
                  <span className="grid size-9 place-items-center rounded-[8px] bg-paper ring-1 ring-inset ring-line group-open:bg-rule">
                    <CategoryIcon name={top.icon} />
                  </span>
                  <span className="flex-1 font-bold">{top.name}</span>
                  {count > 0 && <span className="numerals rounded-full bg-ink px-2 text-white">{count}</span>}
                </summary>
                <div className="grid gap-2 px-3 pb-3">
                  {(top.children.length ? top.children : [{ id: top.id, slug: top.slug, name: top.name }]).map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        name="categories"
                        value={c.id}
                        className="check"
                        defaultChecked={initial.categories.includes(String(c.id))}
                        onChange={(e) => {
                          // read now: the updater may run later, when the event target has changed again
                          const on = e.target.checked;
                          setPicked((s) => {
                            const n = new Set(s);
                            if (on) n.add(String(c.id));
                            else n.delete(String(c.id));
                            return n;
                          });
                        }}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
        {otherPicked && (
          <div className="max-w-xl">
            <label htmlFor="otherServices" className="label">
              Какво е „Друго“? <span className="font-normal text-ink-3">(по желание)</span>
            </label>
            <input
              id="otherServices"
              name="otherServices"
              className="field"
              maxLength={200}
              defaultValue={v.otherServices}
              placeholder="напр. сглобяване на мебели, монтаж на телевизор, дребни поправки"
              aria-describedby="otherServices-hint"
              aria-invalid={Boolean(state.errors?.otherServices)}
            />
            <p id="otherServices-hint" className="hint">
              Показва се в профила ти и клиентите те намират по тези думи в търсенето.
            </p>
            <FieldError id="otherServices-err" message={state.errors?.otherServices} />
          </div>
        )}
      </section>

      <section className="grid gap-4 rounded-[10px] border border-line bg-surface p-5" aria-labelledby="where">
        <h2 id="where" className="text-xl font-extrabold">
          Къде работиш
        </h2>
        <div className="max-w-sm">
          <label htmlFor="city" className="label">
            Основен град
          </label>
          <CitySelect id="city" name="city" value={v.city} cities={cities} invalid={Boolean(state.errors?.city)} />
          <FieldError id="city-err" message={state.errors?.city} />
        </div>
        <fieldset>
          <legend className="label">Пътувам и до</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {regions.map((r) => (
              <div key={r}>
                <p className="mb-1 text-sm font-bold text-ink-3">Област {r}</p>
                <div className="grid gap-1.5">
                  {cities
                    .filter((c) => c.region === r)
                    .map((c) => (
                      <label key={c.slug} className="flex cursor-pointer items-center gap-2.5">
                        <input type="checkbox" name="areas" value={c.slug} className="check" defaultChecked={initial.areas.includes(c.slug)} />
                        {c.name}
                      </label>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="grid gap-4 rounded-[10px] border border-line bg-surface p-5" aria-labelledby="contact">
        <h2 id="contact" className="text-xl font-extrabold">
          Контакти
        </h2>
        <div>
          <p className="label">Имейл</p>
          <p className="text-ink-2">{email}</p>
        </div>
        <div className="max-w-sm">
          <label htmlFor="phone" className="label">
            Телефон
          </label>
          <input id="phone" name="phone" type="tel" inputMode="tel" className="field" defaultValue={v.phone} aria-invalid={Boolean(state.errors?.phone)} />
          <FieldError id="phone-err" message={state.errors?.phone} />
        </div>
        <fieldset>
          <legend className="label">Кой вижда телефона ти</legend>
          <div className="grid gap-2.5">
            {PHONE_OPTIONS.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="phoneVisibility"
                  value={o.value}
                  className="check mt-0.5 rounded-full"
                  defaultChecked={initial.phoneVisibility === o.value}
                />
                <span>
                  <span className="font-bold">{o.label}</span>
                  <span className="block text-sm text-ink-2">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <div className="sticky bottom-3 z-10 grid gap-2 rounded-[10px] bg-ink p-3 text-white shadow-[var(--shadow-lg)] sm:flex sm:items-center">
        <div className="flex-1 [&_p]:bg-transparent [&_p]:p-0 [&_p]:text-rule">
          <FormMessage state={state} />
          {!state.message && <p className="pl-1 text-sm !text-[#d8d4c8]">Промените се виждат веднага в профила.</p>}
        </div>
        <SubmitButton className="btn btn-rule" pendingText="Записваме…">
          Запази профила
        </SubmitButton>
      </div>
    </form>
  );
}
