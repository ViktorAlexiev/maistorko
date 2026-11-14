"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { updateClientProfile, updateCraftsmanProfile } from "@/app/actions/dashboard";
import type { FormState } from "@/app/actions/auth";
import { FieldError } from "@/components/submit-button";
import { CategoryIcon } from "@/components/category-icon";
import type { City } from "@/lib/data";
import { LANGUAGE_LABEL } from "@/lib/format";
import { CLIENT_PARTS, CRAFTSMAN_PARTS, PART_LABEL, PartTabs, SaveBar, st, useProfilePart, type PartId } from "./profile-parts";
import { WhereWork } from "./where-work";

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

export type CraftInitial = {
  displayName: string;
  businessName: string;
  bio: string;
  years: string;
  city: string;
  areas: string[];
  categories: string[];
  languages: string[];
  contactHours: string;
  replyHours: string;
  otherServices: string;
  phone: string;
  phoneVisibility: PhoneVisibility;
};

type ClientInitial = { fullName: string; city: string; phone: string };

// ---------------------------------------------------------------------------
// Which form fields belong to which part. The unsaved-changes dot and the bar are worked out from these.
// ---------------------------------------------------------------------------

type PartFields = Partial<Record<PartId, readonly string[]>>;

const CRAFTSMAN_FIELDS: PartFields = {
  "za-men": ["displayName", "businessName", "bio", "years", "contactHours", "replyHours", "languages"],
  kakvo: ["categories", "otherServices"],
  kade: ["city", "areas"],
  kontakti: ["phone", "phoneVisibility"],
};
const CLIENT_FIELDS: PartFields = { "za-men": ["fullName", "city", "phone"] };

const CRAFTSMAN_LEAD: Partial<Record<PartId, string>> = {
  "za-men": "Това виждат клиентите най-горе на страницата ти.",
  kade: "Клиентите те намират по тези градове.",
  kontakti: "Как да стигат до теб клиентите и какво да ти пращаме.",
};

type Snapshot = Partial<Record<PartId, string>>;

/** What the form holds now, per part. Many-valued fields (ticks) are compared as sorted lists. */
function snapshot(form: HTMLFormElement, fields: PartFields): Snapshot {
  const data = new FormData(form);
  const out: Snapshot = {};
  for (const [part, names] of Object.entries(fields) as [PartId, readonly string[]][]) {
    out[part] = names.map((n) => `${n}=${data.getAll(n).map(String).sort().join("\u0001")}`).join("\u0002");
  }
  return out;
}

const NONE: ReadonlySet<PartId> = new Set();
const NO_STATE: FormState = {};
const sameSet = (a: ReadonlySet<PartId>, b: ReadonlySet<PartId>) => a.size === b.size && [...a].every((p) => b.has(p));

/**
 * Remembers what the form held when it appeared, and after every change tells the owner which parts differ from that.
 * The form keeps every part mounted (the hidden ones too), so one submit always carries all the fields.
 */
function useDirtyParts(fields: PartFields, report: (parts: ReadonlySet<PartId>) => void, state: FormState) {
  const formRef = useRef<HTMLFormElement>(null);
  const base = useRef<Snapshot | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const now = snapshot(form, fields);
    base.current ??= now;
    const was = base.current;
    report(new Set((Object.keys(now) as PartId[]).filter((p) => now[p] !== was[p])));
    // `state` is here because a failed save resets the form to what was sent; the bar has to be worked out again
  }, [tick, state, fields, report]);
  return { formRef, changed: () => setTick((t) => t + 1) };
}

/**
 * The state the outer component keeps so that edits survive a change of part: the part on the screen, the form key
 * (a new key is a fresh form with the saved values), the parts with unsaved changes, and what a finished save does.
 */
function useProfileShell(parts: readonly PartId[], state: FormState, fields: PartFields) {
  const [part, pick] = useProfilePart(parts);
  const [formKey, setFormKey] = useState(0);
  const [dirty, setDirty] = useState<ReadonlySet<PartId>>(NONE);
  const [dismissed, setDismissed] = useState<FormState | null>(null);

  // A saved profile: the page was refreshed on the server, so a new form starts from the new values.
  const [seen, setSeen] = useState(state);
  if (seen !== state) {
    setSeen(state);
    if (state.ok) {
      setFormKey((k) => k + 1);
      setDirty(NONE);
    }
  }

  // A new answer from the server, handled once: the confirmation, or the part that holds a field with an error.
  const handled = useRef(state);
  useEffect(() => {
    if (handled.current === state) return;
    handled.current = state;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      return;
    }
    const wrong = Object.keys(state.errors ?? {});
    const target = parts.find((p) => fields[p]?.some((f) => wrong.includes(f)));
    if (target && target !== part) pick(target);
  }, [state, parts, fields, part, pick]);

  const report = useCallback((next: ReadonlySet<PartId>) => setDirty((prev) => (sameSet(prev, next) ? prev : next)), []);
  const cancel = () => {
    setDismissed(state);
    setFormKey((k) => k + 1);
    setDirty(NONE);
  };
  // After „Отказ“ the old answer (error text, sent values) is not shown again
  const live = state === dismissed ? NO_STATE : state;
  return { part, pick, formKey, dirty, report, cancel, live };
}

/** A part of the page; the ones not on the screen stay mounted but hidden. */
function Pane({ on, className, children }: { on: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div hidden={!on} className={on ? className : "hidden"}>
      {children}
    </div>
  );
}

/** The frame both profiles share: the word menu, one part at a time, the slots that sit outside the form. */
function Shell({
  parts,
  shell,
  lead,
  avatar,
  notifications,
  myData,
  children,
}: {
  parts: readonly PartId[];
  shell: ReturnType<typeof useProfileShell>;
  lead?: string;
  avatar: React.ReactNode;
  notifications: React.ReactNode;
  myData: React.ReactNode;
  children: React.ReactNode;
}) {
  const { part } = shell;
  return (
    <div className={shell.dirty.size > 0 ? "pb-24" : ""}>
      <PartTabs parts={parts} current={part} dirty={shell.dirty} onPick={shell.pick} />
      <section aria-label={PART_LABEL[part]} className="mt-7 grid max-w-2xl gap-5">
        {lead && <p className="mb-1 text-lg text-ink-2">{lead}</p>}
        <Pane on={part === "za-men"}>{avatar}</Pane>
        {children}
        <Pane on={part === "kontakti"} className={parts.includes("kakvo") ? "mt-5" : undefined}>
          {notifications}
        </Pane>
        <Pane on={part === "danni"}>{myData}</Pane>
      </section>
    </div>
  );
}

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

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export function ClientProfileForm({
  email,
  cities,
  initial,
  avatar,
  notifications,
  myData,
}: {
  email: string;
  cities: City[];
  initial: ClientInitial;
  avatar: React.ReactNode;
  notifications: React.ReactNode;
  myData: React.ReactNode;
}) {
  const [state, action] = useActionState<FormState, FormData>(updateClientProfile, {});
  const shell = useProfileShell(CLIENT_PARTS, state, CLIENT_FIELDS);
  const values = shell.live.values;
  const v: ClientInitial = {
    fullName: values?.fullName ?? initial.fullName,
    city: values?.city ?? initial.city,
    phone: values?.phone ?? initial.phone,
  };
  return (
    <Shell parts={CLIENT_PARTS} shell={shell} avatar={avatar} notifications={notifications} myData={myData}>
      <ClientFields
        key={shell.formKey}
        action={action}
        state={shell.live}
        part={shell.part}
        dirty={shell.dirty.size > 0}
        report={shell.report}
        onCancel={shell.cancel}
        email={email}
        cities={cities}
        v={v}
      />
    </Shell>
  );
}

function ClientFields({
  action,
  state,
  part,
  dirty,
  report,
  onCancel,
  email,
  cities,
  v,
}: {
  action: (formData: FormData) => void;
  state: FormState;
  part: PartId;
  dirty: boolean;
  report: (parts: ReadonlySet<PartId>) => void;
  onCancel: () => void;
  email: string;
  cities: City[];
  v: ClientInitial;
}) {
  const { formRef, changed } = useDirtyParts(CLIENT_FIELDS, report, state);
  return (
    <form ref={formRef} action={action} className="contents" noValidate onInput={changed} onChange={changed}>
      <Pane on={part === "za-men"} className="grid gap-5">
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
      </Pane>
      {dirty && <SaveBar state={state} onCancel={onCancel} text="Имате незаписани промени" />}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Craftsman
// ---------------------------------------------------------------------------

/** The server's answer to a failed save carries the text fields; the ticks and the radio are added so a failed save loses nothing. */
async function saveCraftsman(prev: FormState, formData: FormData): Promise<FormState> {
  const result = await updateCraftsmanProfile(prev, formData);
  if (result.ok) return result;
  const sent = Object.fromEntries(
    ["categories", "areas", "languages", "phoneVisibility"].map((k) => [k, formData.getAll(k).map(String).join(",")]),
  );
  return { ...result, values: { ...result.values, ...sent } };
}

export function CraftsmanProfileForm({
  email,
  cities,
  tree,
  initial,
  maxAreas,
  avatar,
  notifications,
  myData,
}: {
  email: string;
  cities: City[];
  tree: Tree;
  initial: CraftInitial;
  /** extra cities besides the main one; null = unlimited */
  maxAreas: number | null;
  avatar: React.ReactNode;
  notifications: React.ReactNode;
  myData: React.ReactNode;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveCraftsman, {});
  const shell = useProfileShell(CRAFTSMAN_PARTS, state, CRAFTSMAN_FIELDS);
  const values = shell.live.values;
  const list = (key: string, fallback: string[]) => {
    const sent = values?.[key];
    return sent === undefined ? fallback : sent ? sent.split(",") : [];
  };
  const v: CraftInitial = {
    displayName: values?.displayName ?? initial.displayName,
    businessName: values?.businessName ?? initial.businessName,
    bio: values?.bio ?? initial.bio,
    years: values?.years ?? initial.years,
    city: values?.city ?? initial.city,
    areas: list("areas", initial.areas),
    categories: list("categories", initial.categories),
    languages: list("languages", initial.languages),
    contactHours: values?.contactHours ?? initial.contactHours,
    replyHours: values?.replyHours ?? initial.replyHours,
    otherServices: values?.otherServices ?? initial.otherServices,
    phone: values?.phone ?? initial.phone,
    phoneVisibility: (values?.phoneVisibility ?? initial.phoneVisibility) as PhoneVisibility,
  };
  return (
    <Shell
      parts={CRAFTSMAN_PARTS}
      shell={shell}
      lead={CRAFTSMAN_LEAD[shell.part]}
      avatar={avatar}
      notifications={notifications}
      myData={myData}
    >
      <CraftsmanFields
        key={shell.formKey}
        action={action}
        state={shell.live}
        part={shell.part}
        dirty={shell.dirty.size > 0}
        report={shell.report}
        onCancel={shell.cancel}
        email={email}
        cities={cities}
        tree={tree}
        maxAreas={maxAreas}
        v={v}
      />
    </Shell>
  );
}

function CraftsmanFields({
  action,
  state,
  part,
  dirty,
  report,
  onCancel,
  email,
  cities,
  tree,
  maxAreas,
  v,
}: {
  action: (formData: FormData) => void;
  state: FormState;
  part: PartId;
  dirty: boolean;
  report: (parts: ReadonlySet<PartId>) => void;
  onCancel: () => void;
  email: string;
  cities: City[];
  tree: Tree;
  maxAreas: number | null;
  v: CraftInitial;
}) {
  const { formRef, changed } = useDirtyParts(CRAFTSMAN_FIELDS, report, state);
  const [picked, setPicked] = useState(() => new Set(v.categories));
  // Which category strips are open
  const [openIds, setOpenIds] = useState<Set<number>>(
    () => new Set(tree.filter((t) => t.children.some((c) => v.categories.includes(String(c.id))) || v.categories.includes(String(t.id))).map((t) => t.id)),
  );
  const [bioLen, setBioLen] = useState(v.bio.length);
  // Every failed save remounts „Къде работя“ with the sent values, so the reset form does not fall back to the old city and ticks
  const [seen, setSeen] = useState(state);
  const [round, setRound] = useState(0);
  if (seen !== state) {
    setSeen(state);
    setRound((r) => r + 1);
  }
  const otherIds = new Set(
    tree.flatMap((t) => [t, ...t.children]).filter((c) => OTHER_SLUGS.has(c.slug)).map((c) => String(c.id)),
  );
  const otherPicked = [...picked].some((id) => otherIds.has(id));

  return (
    <form ref={formRef} action={action} className="contents" noValidate onInput={changed} onChange={changed}>
      <Pane on={part === "za-men"} className="grid gap-5">
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
          <div>
            <label htmlFor="replyHours" className="label">
              Обикновено отговарям за <span className="font-normal text-ink-3">(по желание)</span>
            </label>
            <select id="replyHours" name="replyHours" className="field" defaultValue={v.replyHours}>
              <option value="">Не показвай</option>
              <option value="1">до 1 час</option>
              <option value="2">до 2 часа</option>
              <option value="4">до 4 часа</option>
              <option value="24">до 24 часа</option>
              <option value="48">до 2 дни</option>
            </select>
            <p className="hint">Клиентите го виждат в профила ти. Бързият отговор е това, което печели работа.</p>
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
      </Pane>

      <Pane on={part === "kakvo"} className="grid gap-4">
        <div>
          <p className="text-lg text-ink-2">
            Избери конкретните услуги. Показваш се в търсенето по тях.{" "}
            <span className="whitespace-nowrap">
              <span className="numerals text-xl text-ink">{picked.size}</span> избрани.
            </span>
          </p>
          <FieldError id="categories-err" message={state.errors?.categories} />
        </div>
        <div className={st.folds}>
          {tree.map((top) => {
            const count = top.children.filter((c) => picked.has(String(c.id))).length + (picked.has(String(top.id)) ? 1 : 0);
            return (
              <details
                key={top.id}
                className={st.fold}
                open={openIds.has(top.id)}
                onToggle={(e) => {
                  const now = e.currentTarget.open;
                  setOpenIds((s) => {
                    if (s.has(top.id) === now) return s;
                    const n = new Set(s);
                    if (now) n.add(top.id);
                    else n.delete(top.id);
                    return n;
                  });
                }}
              >
                <summary className={st.foldSummary}>
                  <CategoryIcon name={top.icon} className="size-5 shrink-0 text-ink-2" />
                  <span className="flex-1 font-bold">{top.name}</span>
                  {count > 0 && (
                    <span className="text-sm text-ink-2">
                      <span className="numerals text-lg text-ink">{count}</span> {count === 1 ? "избрана" : "избрани"}
                    </span>
                  )}
                  <ChevronRight
                    className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none"
                    aria-hidden
                  />
                </summary>
                <ul className={`grid sm:grid-cols-2 sm:gap-x-6 ${st.foldBody}`}>
                  {(top.children.length ? top.children : [{ id: top.id, slug: top.slug, name: top.name }]).map((c) => (
                    <li key={c.id}>
                      <label className={`cursor-pointer ${st.rowIn}`}>
                        <input
                          type="checkbox"
                          name="categories"
                          value={c.id}
                          className="check"
                          defaultChecked={v.categories.includes(String(c.id))}
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
                    </li>
                  ))}
                </ul>
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
      </Pane>

      {/* „Къде работя“ is this one block, so it can be swapped for another without touching the rest */}
      <Pane on={part === "kade"} className="grid gap-6">
        <WhereWork
          key={round}
          cities={cities}
          initialCity={v.city}
          initialAreas={v.areas}
          maxAreas={maxAreas}
          cityError={state.errors?.city}
        />
      </Pane>

      <Pane on={part === "kontakti"} className="grid gap-5">
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
          <div className={st.list}>
            {PHONE_OPTIONS.map((o) => (
              <label key={o.value} className={`cursor-pointer ${st.rowTall}`}>
                <input type="radio" name="phoneVisibility" value={o.value} className="check mt-0.5" defaultChecked={v.phoneVisibility === o.value} />
                <span>
                  <span className="font-bold">{o.label}</span>
                  <span className="block text-sm text-ink-2">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </Pane>

      {dirty && <SaveBar state={state} onCancel={onCancel} />}
    </form>
  );
}
