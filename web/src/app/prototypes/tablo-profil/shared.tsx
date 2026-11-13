"use client";

import { useId, useRef, useState } from "react";
import { Camera, ChevronRight, Download, X } from "lucide-react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/category-icon";
import { LANGUAGE_LABEL } from "@/lib/format";
import { Bar, Index } from "../tablo-nav/variant-indeks";
import { EMAIL, INITIAL, PART_FIELDS, PARTS, PHONE_OPTIONS, TREE, type Profile } from "./data";
import "./proto.css";

// ---------------------------------------------------------------------------
// Separation without thin lines, approved as „Плочки“: every row is its own light strip, what is picked turns pale yellow.
// ---------------------------------------------------------------------------

const NO_MARKER = "list-none [&::-webkit-details-marker]:hidden";

export const st = {
  /** wrapper of rows in one column */
  list: "grid gap-1",
  /** wrapper of rows in two columns from `sm` */
  grid2: "grid gap-1 sm:grid-cols-2",
  /** one tick row */
  row: "flex min-h-12 items-center gap-3 rounded-[6px] bg-surface px-3 transition-colors has-[:checked]:bg-rule-soft",
  /** the same row when the limit has switched it off */
  rowOff: "cursor-not-allowed !bg-surface-2 text-ink-3",
  /** a row with a second line of explanation */
  rowTall: "flex items-start gap-3 rounded-[6px] bg-surface px-3 py-3 transition-colors has-[:checked]:bg-rule-soft",
  /** a tick row inside a fold */
  rowIn: "flex min-h-11 items-center gap-3",
  /** small name above a group of rows */
  label: "mb-2 text-sm font-bold text-ink-3",
  /** wrapper of fold-out rows */
  folds: "grid gap-1",
  fold: "group rounded-[6px] bg-surface",
  foldSummary: `flex min-h-12 cursor-pointer items-center gap-3 px-3 ${NO_MARKER}`,
  foldBody: "pb-2 pl-11 pr-3",
  /** distance between two blocks of one part */
  blocks: "grid max-w-2xl gap-10",
  /** the list of what gets deleted, inside the popup */
  facts: "mt-2 grid gap-1",
  fact: "rounded-[6px] bg-paper px-3 py-2.5 font-semibold",
};

// ---------------------------------------------------------------------------
// The draft: one profile, saved in one go; the bar shows only while something differs from what is saved.
// ---------------------------------------------------------------------------

const same = (a: unknown, b: unknown) =>
  Array.isArray(a) && Array.isArray(b) ? a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|") : a === b;

type ListKey = "languages" | "categories" | "areas";

export type Letters = { messages: boolean; bookings: boolean; reviews: boolean; calendar: boolean };

export function useDraft() {
  const [saved, setSaved] = useState<Profile>(INITIAL);
  const [v, setV] = useState<Profile>(INITIAL);
  const [letters, setLetters] = useState<Letters>({ messages: true, bookings: true, reviews: true, calendar: false });

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setV((p) => ({ ...p, [key]: value }));
  const toggle = (key: ListKey, item: string, on: boolean) =>
    setV((p) => ({ ...p, [key]: on ? [...p[key].filter((x) => x !== item), item] : p[key].filter((x) => x !== item) }));
  /** The main city never also sits among the extra ones. */
  const setCity = (slug: string) => setV((p) => ({ ...p, city: slug, areas: p.areas.filter((a) => a !== slug) }));
  /** Letters are saved at once, as they are today; they never raise the save bar. */
  const setLetter = (key: keyof Letters, on: boolean) => {
    setLetters((l) => ({ ...l, [key]: on }));
    toast.success(on ? "Ще получаваш такива писма." : "Спряно.");
  };

  const dirtyParts = PARTS.map((p) => p.key).filter((k) => PART_FIELDS[k].some((f) => !same(v[f], saved[f])));
  const save = () => {
    if (!v.displayName.trim()) return void toast.error("Напиши името си, преди да запишеш.");
    setSaved(v);
    toast.success("Профилът е записан.");
  };
  const reset = () => setV(saved);

  return { v, set, toggle, setCity, letters, setLetter, dirty: dirtyParts.length > 0, dirtyParts, save, reset };
}

export type Draft = ReturnType<typeof useDraft>;

// ---------------------------------------------------------------------------
// The dashboard frame with the approved „Индекс“ navigation, „Профил“ current.
// ---------------------------------------------------------------------------

const elsewhere = () => void toast("В тази проба работи само „Профил“.");

export function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="proto-nolines mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 sm:py-10 lg:pb-10">
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <Index active="profil" pick={elsewhere} />
          </div>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
      <div className="lg:hidden">
        <Bar active="profil" pick={elsewhere} />
      </div>
    </div>
  );
}

export const proLink = (
  <a
    href="/tabla/plan"
    className="link font-bold"
    onClick={(e) => {
      e.preventDefault();
      toast("В продукта това води към „План“.");
    }}
  >
    Виж Pro
  </a>
);

// ---------------------------------------------------------------------------
// Fields of each part.
// ---------------------------------------------------------------------------

function Text({
  label,
  optional,
  value,
  onChange,
  ...rest
}: {
  label: string;
  optional?: boolean;
  value: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {optional && <span className="font-normal text-ink-3"> (по желание)</span>}
      </label>
      <input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </div>
  );
}

function AvatarRow({ name }: { name: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toLocaleUpperCase("bg"))
    .join("");
  return (
    <div className="flex items-center gap-5">
      <div
        className="display grid size-24 shrink-0 place-items-center rounded-[8px] bg-[#dbe2ec] bg-cover bg-center text-4xl"
        style={url ? { backgroundImage: `url(${url})` } : undefined}
        role="img"
        aria-label={url ? "Твоята снимка" : `Инициали ${initials}`}
      >
        {!url && initials}
      </div>
      <div className="grid gap-2">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setUrl(URL.createObjectURL(f));
              toast.success("Снимката е сменена.");
            }
            e.target.value = "";
          }}
        />
        <button type="button" className="btn btn-outline" onClick={() => input.current?.click()}>
          <Camera className="size-4" aria-hidden /> {url ? "Смени снимката" : "Качи снимка"}
        </button>
        <p className="text-sm text-ink-3">JPG, PNG или WEBP, до 2 MB.</p>
      </div>
    </div>
  );
}

export function AboutFields({ d }: { d: Draft }) {
  const { v, set, toggle } = d;
  const bioId = useId();
  return (
    <div className="grid max-w-2xl gap-5">
      <AvatarRow name={v.displayName} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Text label="Име" value={v.displayName} onChange={(x) => set("displayName", x)} autoComplete="name" />
        <Text label="Фирма" optional value={v.businessName} onChange={(x) => set("businessName", x)} />
      </div>
      <div>
        <label htmlFor={bioId} className="label">
          За теб
        </label>
        <textarea
          id={bioId}
          rows={5}
          maxLength={1500}
          className="field"
          value={v.bio}
          onChange={(e) => set("bio", e.target.value)}
          placeholder="С какво се занимаваш, от колко години, с какво си по-добър от другите. Пиши като на клиент."
        />
        <p className="hint flex justify-between">
          <span>Няколко изречения са достатъчни.</span>
          <span className="tabular">{v.bio.length}/1500</span>
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Text label="Години опит" value={v.years} onChange={(x) => set("years", x.replace(/\D/g, ""))} inputMode="numeric" />
        <Text
          label="Кога отговаряш"
          optional
          value={v.contactHours}
          onChange={(x) => set("contactHours", x)}
          maxLength={80}
          placeholder="напр. вечер след 18 ч."
        />
      </div>
      <fieldset>
        <legend className="label">Езици</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(LANGUAGE_LABEL).map(([code, label]) => (
            <label key={code} className="chip">
              <input
                type="checkbox"
                className="sr-only"
                checked={v.languages.includes(code)}
                onChange={(e) => toggle("languages", code, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

/** Categories as fold-out rows, without boxes. */
export function WorkFields({ d }: { d: Draft }) {
  const { v, set, toggle } = d;
  const picked = new Set(v.categories);
  const [open, setOpen] = useState(
    () => new Set(TREE.filter((t) => t.children.some((c) => v.categories.includes(c.slug))).map((t) => t.slug)),
  );
  const otherId = useId();

  return (
    <div className="grid max-w-2xl gap-4">
      <p className="text-lg text-ink-2">
        Избери конкретните услуги. Показваш се в търсенето по тях.{" "}
        <span className="whitespace-nowrap">
          <span className="numerals text-xl text-ink">{picked.size}</span> избрани.
        </span>
      </p>
      <div className={st.folds}>
        {TREE.map((t) => {
          const count = t.children.filter((c) => picked.has(c.slug)).length;
          return (
            <details
              key={t.slug}
              className={st.fold}
              open={open.has(t.slug)}
              onToggle={(e) => {
                const now = e.currentTarget.open;
                setOpen((s) => {
                  if (s.has(t.slug) === now) return s;
                  const n = new Set(s);
                  if (now) n.add(t.slug);
                  else n.delete(t.slug);
                  return n;
                });
              }}
            >
              <summary className={st.foldSummary}>
                <CategoryIcon name={t.icon} className="size-5 shrink-0 text-ink-2" />
                <span className="flex-1 font-bold">{t.name}</span>
                {count > 0 && (
                  <span className="text-sm text-ink-2">
                    <span className="numerals text-lg text-ink">{count}</span> {count === 1 ? "избрана" : "избрани"}
                  </span>
                )}
                <ChevronRight className="size-4 shrink-0 text-ink-3 transition-transform duration-200 group-open:rotate-90" aria-hidden />
              </summary>
              <ul className={`grid sm:grid-cols-2 sm:gap-x-6 ${st.foldBody}`}>
                {t.children.map((c) => (
                  <li key={c.slug}>
                    <label className={`cursor-pointer ${st.rowIn}`}>
                      <input
                        type="checkbox"
                        className="check"
                        checked={picked.has(c.slug)}
                        onChange={(e) => toggle("categories", c.slug, e.target.checked)}
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
      {picked.has("drugi-uslugi") && (
        <div className="max-w-xl">
          <label htmlFor={otherId} className="label">
            Какво е „Друго“? <span className="font-normal text-ink-3">(по желание)</span>
          </label>
          <input
            id={otherId}
            className="field"
            maxLength={200}
            value={v.otherServices}
            onChange={(e) => set("otherServices", e.target.value)}
            placeholder="напр. сглобяване на мебели, монтаж на телевизор, дребни поправки"
          />
          <p className="hint">Показва се в профила ти и клиентите те намират по тези думи в търсенето.</p>
        </div>
      )}
    </div>
  );
}

const LETTER_OPTIONS: { key: keyof Letters; label: string; hint: string }[] = [
  {
    key: "messages",
    label: "Нови съобщения",
    hint: "Пращаме писмо само ако не си го прочел в сайта до 10 минути. Няколко съобщения са едно писмо.",
  },
  { key: "bookings", label: "Уговорки", hint: "Предложена, потвърдена или отменена уговорка." },
  { key: "reviews", label: "Нови отзиви", hint: "Когато някой остави отзив за теб." },
  { key: "calendar", label: "Напомняне за календара", hint: "Веднъж седмично, ако не си потвърждавал графика си." },
];

export function ContactFields({ d }: { d: Draft }) {
  const { v, set, letters, setLetter } = d;
  const group = useId();
  return (
    <div className={st.blocks}>
      <div className="grid gap-5">
        <div>
          <p className="label">Имейл</p>
          <p className="text-ink-2">{EMAIL}</p>
        </div>
        <div className="max-w-sm">
          <Text label="Телефон" value={v.phone} onChange={(x) => set("phone", x)} type="tel" inputMode="tel" autoComplete="tel" />
        </div>
        <fieldset>
          <legend className="label">Кой вижда телефона ти</legend>
          <div className={st.list}>
            {PHONE_OPTIONS.map((o) => (
              <label key={o.value} className={`cursor-pointer ${st.rowTall}`}>
                <input
                  type="radio"
                  name={group}
                  className="check mt-0.5"
                  checked={v.phoneVisibility === o.value}
                  onChange={() => set("phoneVisibility", o.value)}
                />
                <span>
                  <span className="font-bold">{o.label}</span>
                  <span className="block text-sm text-ink-2">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <fieldset>
        <legend className="text-xl font-extrabold">Писма на имейла</legend>
        <p className="mt-1 text-sm text-ink-2">
          Известията в сайта (камбанката) винаги работят. Тук избираш кое да идва и по имейл. Записва се веднага.
        </p>
        <div className={`mt-3 ${st.list}`}>
          {LETTER_OPTIONS.map((o) => (
            <label key={o.key} className={`cursor-pointer ${st.rowTall}`}>
              <input type="checkbox" className="check mt-0.5" checked={letters[o.key]} onChange={(e) => setLetter(o.key, e.target.checked)} />
              <span>
                <span className="font-bold">{o.label}</span>
                <span className="block text-sm text-ink-2">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}

function download() {
  const blob = new Blob([JSON.stringify({ profil: INITIAL, imeyl: EMAIL }, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "maistorlaka-moite-danni.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

export function DataFields() {
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className={st.blocks}>
      <div>
        <h3 className="text-xl font-extrabold">Сваляне на данните</h3>
        <p className="mt-1 text-ink-2">Можеш да свалиш всичко, което пазим за теб, в един файл.</p>
        <button type="button" className="btn btn-outline mt-3" onClick={download}>
          <Download className="size-4" aria-hidden /> Свали данните ми (JSON)
        </button>
      </div>
      <div>
        <h3 className="text-xl font-extrabold">Изтриване на профила</h3>
        <p className="mt-1 text-ink-2">Профилът и всичко към него се изтрива завинаги. Преди това ще те питаме още веднъж.</p>
        <button type="button" className="btn btn-danger mt-3" onClick={() => dialog.current?.showModal()}>
          Изтрий профила
        </button>
      </div>
      <DeleteDialog ref={dialog} />
    </div>
  );
}

const DELETED = [
  "Профилът ти със снимките и цените",
  "Разговорите с клиентите",
  "Поръчките и офертите",
  "Отзивите за теб и отзивите, които си написал",
];

/** The popup behind „Изтрий профила“: what goes, a way out, and the typed word. A sheet on phones, a dialog on wider screens. */
export function DeleteDialog({ ref }: { ref: React.RefObject<HTMLDialogElement | null> }) {
  const [word, setWord] = useState("");
  const ok = word.trim().toLocaleUpperCase("bg") === "ИЗТРИЙ";
  const close = () => ref.current?.close();
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="proto-del-title"
      onClose={() => setWord("")}
      onClick={(e) => e.target === ref.current && close()}
    >
      <form
        className="safe-bottom grid gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ok) return;
          close();
          toast("Проба: тук профилът се изтрива и излизаш на началната страница.");
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="proto-del-title" className="display text-4xl">
            Изтриване на профила
          </h2>
          <button type="button" className="btn btn-ghost btn-sm -mr-2 -mt-1" onClick={close} aria-label="Затвори">
            <X className="size-6" aria-hidden />
          </button>
        </div>
        <div>
          <p className="text-ink-2">Изтрива се завинаги и не може да се върне:</p>
          <ul className={st.facts}>
            {DELETED.map((x) => (
              <li key={x} className={st.fact}>
                {x}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-ink-2">
          Ако искаш да запазиш нещо, първо{" "}
          <button type="button" className="link font-bold text-ink" onClick={download}>
            свали данните си
          </button>
          .
        </p>
        <div>
          <label htmlFor="proto-del-word" className="label">
            За да потвърдиш, напиши ИЗТРИЙ
          </label>
          <input
            id="proto-del-word"
            className="field"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={word}
            onChange={(e) => setWord(e.target.value)}
          />
        </div>
        <div className="grid gap-2 sm:flex sm:flex-row-reverse">
          <button
            type="submit"
            className="btn bg-danger text-white hover:bg-[#912018] disabled:bg-surface-2 disabled:text-ink-3 disabled:opacity-100"
            disabled={!ok}
          >
            Изтрий профила завинаги
          </button>
          <button type="button" className="btn btn-outline" onClick={close}>
            Отказ
          </button>
        </div>
      </form>
    </dialog>
  );
}
