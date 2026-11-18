"use client";

import { useActionState, useEffect, useLayoutEffect, useRef, useState } from "react";
import { BadgeEuro, CalendarDays, Check, ImagePlus, LoaderCircle, SendHorizontal, Wrench, X } from "lucide-react";
import { startConversation } from "@/app/actions/engage";
import type { FormState } from "@/app/actions/auth";
import { MAX_ATTACHMENTS, uploadChatPhotos } from "@/app/saobshtenia/[id]/chat-photos";
import { enterSends } from "@/app/saobshtenia/[id]/thread";
import { Avatar } from "@/components/avatar";
import type { Craftsman, WorkOption } from "@/components/chat-dock";
import { DateField } from "@/components/date-time-fields";
import { checkImage } from "@/components/image-upload";
import { FormMessage } from "@/components/submit-button";
import { MONTHS_SHORT, relativeDay, WEEKDAYS_SHORT } from "@/lib/format";
import { composeAnswers, questionsFor } from "@/lib/inquiry-questions";
import { SLOT_DEFS, slotLabel, type Slot } from "@/lib/slots";
import { createClient } from "@/lib/supabase/client";

type Sheet = "date" | "work" | "price";
type Photo = { key: string; src: string; /** null while it uploads */ path: string | null };

/** „чт, 19 ное · сутрин“ */
function dateChip(date: string, slot: Slot | null) {
  const d = new Date(`${date}T00:00:00Z`);
  const day = `${WEEKDAYS_SHORT[(d.getUTCDay() + 6) % 7]}, ${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
  const part = SLOT_DEFS.find((s) => s.key === slot)?.label.toLowerCase();
  return part ? `${day} · ${part}` : day;
}

const removeFromStorage = (paths: string[]) => {
  if (paths.length) void createClient().storage.from("chat-photos").remove(paths);
};

/**
 * The first message, written in the same composer as the conversation it becomes: chips for date, work and
 * price open sheets over the window; photos upload at once into the folder of the future conversation.
 */
export function FirstMessage({
  craftsman,
  workOptions,
  date,
  slot,
  onDate,
  onSlot,
  today,
  busyDay,
  newId,
  onStarted,
}: {
  craftsman: Craftsman;
  workOptions: WorkOption[];
  date: string | null;
  slot: Slot | null;
  onDate: (d: string | null) => void;
  onSlot: (s: Slot | null) => void;
  today: string;
  busyDay: boolean;
  newId: string;
  onStarted: (id: string) => void;
}) {
  const [state, action, sending] = useActionState<FormState, FormData>(startConversation, {});
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [work, setWork] = useState("");
  const [prevState, setPrevState] = useState(state);
  if (prevState !== state) {
    setPrevState(state);
    if (state.values?.body !== undefined) setBody(state.values.body);
  }
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [note, setNote] = useState("");
  const [catSlug, setCatSlug] = useState(craftsman.categories?.[0]?.slug ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const opener = useRef<HTMLElement | null>(null);
  const sheetBox = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  // Photos already in the bucket, so that closing the window can delete the ones that never left with a message
  const uploaded = useRef(new Set<string>());
  const removed = useRef(new Set<string>());
  const urls = useRef<string[]>([]);
  const seq = useRef(0);
  const sent = useRef(false);
  // Set from the moment the message goes out: closing the window then must not delete its photos
  const submitting = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const u = urls.current;
    const up = uploaded.current;
    return () => {
      mounted.current = false;
      u.forEach((x) => URL.revokeObjectURL(x));
      // The page was left (closing or collapsing the window does not unmount it): unsent photos go
      if (!sent.current && !submitting.current) removeFromStorage([...up]);
    };
  }, []);

  useEffect(() => {
    if (state.errors || (state.message && !state.ok)) submitting.current = false;
    if (state.ok && state.id) {
      sent.current = true;
      onStarted(state.id);
    }
  }, [state, onStarted]);

  // The field grows with its text, up to about six lines
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + el.offsetHeight - el.clientHeight, 160)}px`;
  }, [body]);

  const priced = workOptions.filter((o) => o.priced);
  const other = workOptions.filter((o) => !o.priced);
  const cats = craftsman.categories ?? [];
  const questions = questionsFor(catSlug);
  const composed = composeAnswers(questions, answers);
  const uploading = photos.some((p) => p.path === null);
  const full = photos.length >= MAX_ATTACHMENTS;
  const workLabel = workOptions.find((o) => o.value === work)?.label ?? "";
  const place = [cats[0]?.name, craftsman.city].filter(Boolean).join(" · ");
  const shownError = error || state.errors?.body || "";

  const openSheet = (s: Sheet, el: HTMLElement) => {
    opener.current = el;
    setSheet(s);
    requestAnimationFrame(() => sheetBox.current?.focus());
  };
  const closeSheet = () => {
    setSheet(null);
    opener.current?.focus();
  };

  async function addPhotos(files: File[]) {
    const supabase = createClient();
    const problems: string[] = [];
    const ok: File[] = [];
    for (const f of files) {
      const p = checkImage(f, 5);
      if (p) problems.push(`${f.name}: ${p}`);
      else ok.push(f);
    }
    const take = ok.slice(0, Math.max(MAX_ATTACHMENTS - photos.length, 0));
    if (ok.length > take.length) problems.unshift(`Най-много ${MAX_ATTACHMENTS} снимки в едно съобщение. Останалите не са добавени.`);
    setNote(problems.join(" "));
    if (!take.length) return;
    const fresh = take.map((file) => {
      const src = URL.createObjectURL(file);
      urls.current.push(src);
      return { file, photo: { key: `p${++seq.current}`, src, path: null } as Photo };
    });
    setPhotos((xs) => [...xs, ...fresh.map((x) => x.photo)]);
    for (const { file, photo } of fresh) {
      const { paths, errors } = await uploadChatPhotos(supabase, newId, [file]);
      const path = paths[0] ?? null;
      // taken off while it was uploading, or the window was closed meanwhile: the file goes too
      if (path && (removed.current.has(photo.key) || !mounted.current)) {
        removeFromStorage([path]);
        continue;
      }
      if (!mounted.current) continue;
      if (!path) {
        setPhotos((xs) => xs.filter((x) => x.key !== photo.key));
        setNote((n) => [n, ...errors].filter(Boolean).join(" "));
        continue;
      }
      uploaded.current.add(path);
      setPhotos((xs) => xs.map((x) => (x.key === photo.key ? { ...x, path } : x)));
    }
  }

  function removePhoto(p: Photo) {
    setNote("");
    removed.current.add(p.key);
    if (p.path) {
      uploaded.current.delete(p.path);
      removeFromStorage([p.path]);
    }
    setPhotos((xs) => xs.filter((x) => x.key !== p.key));
  }

  const chip = (s: Sheet, set: boolean, icon: React.ReactNode, text: string) => (
    <button
      type="button"
      className={`chip min-h-11 max-w-full ${set ? "!border-rule-soft !bg-rule-soft !text-ink" : ""}`}
      aria-haspopup="dialog"
      aria-expanded={sheet === s}
      onClick={(e) => openSheet(s, e.currentTarget)}
    >
      {icon}
      <span className="truncate">{text}</span>
    </button>
  );

  return (
    <form
      action={action}
      noValidate
      className="relative flex min-h-0 flex-1 flex-col bg-paper"
      onSubmit={(e) => {
        if (sending || uploading) return e.preventDefault();
        if (!body.trim()) {
          e.preventDefault();
          setError("Напишете съобщение.");
          field.current?.focus();
          return;
        }
        submitting.current = true;
      }}
    >
      <input type="hidden" name="craftsmanId" value={craftsman.id} />
      <input type="hidden" name="slug" value={craftsman.slug} />
      <input type="hidden" name="inline" value="1" />
      <input type="hidden" name="id" value={newId} />
      <input type="hidden" name="date" value={date ?? ""} />
      <input type="hidden" name="slot" value={date && slot ? slot : ""} />
      <input type="hidden" name="work" value={work} />
      <input type="hidden" name="photos" value={JSON.stringify(photos.flatMap((p) => (p.path ? [p.path] : [])))} />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6 text-center">
        <div className="m-auto grid justify-items-center gap-2">
          <Avatar name={craftsman.name} url={craftsman.avatar} size={56} />
          <p className="text-lg font-extrabold leading-tight">Пишете на {craftsman.name}</p>
          {place && <p className="-mt-1 text-sm font-semibold text-ink-2">{place}</p>}
          <p className="mt-1 max-w-[18rem] text-ink-2">
            Опишете какво трябва да се направи. Датата, работата и снимките са по желание и тръгват заедно със съобщението.
          </p>
        </div>
      </div>

      <div className="safe-bottom bg-surface px-3 pt-2">
        <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="Към съобщението">
          {chip("date", Boolean(date), <CalendarDays className="size-4 shrink-0" aria-hidden />, date ? dateChip(date, slot) : "Дата")}
          {chip("work", Boolean(work), <Wrench className="size-4 shrink-0" aria-hidden />, workLabel || "Каква работа")}
          {chip("price", false, <BadgeEuro className="size-4 shrink-0" aria-hidden />, "Цена")}
        </div>
        {photos.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-2 pr-3 pt-3" aria-label="Снимки към съобщението">
            {photos.map((p) => (
              <li key={p.key} className="relative size-16">
                <div className="relative size-full overflow-hidden rounded-[6px] bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt="Избрана снимка" className="size-full object-cover" />
                  {p.path === null && (
                    <span className="absolute inset-0 grid place-items-center bg-surface/70" role="status" aria-label="Снимката се качва">
                      <LoaderCircle className="size-6 animate-spin text-ink motion-reduce:animate-none" aria-hidden />
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="absolute -right-2.5 -top-2.5 grid size-11 place-items-center"
                  aria-label="Махни снимката"
                  onClick={() => removePhoto(p)}
                >
                  <span className="grid size-6 place-items-center rounded-full bg-ink text-white shadow-[var(--shadow-sm)]">
                    <X className="size-3.5" aria-hidden />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {note && (
          <p role="alert" className="error-text !mt-0 mb-2">
            {note}
          </p>
        )}
        {shownError && (
          <p id="fm-err" role="alert" className="error-text !mt-0 mb-2">
            {shownError}
          </p>
        )}
        {!state.ok && state.message && (
          <div className="mb-2">
            <FormMessage state={state} />
          </div>
        )}
        {sending && (
          <p role="status" className="mb-2 text-sm font-semibold text-ink-2">
            Изпращаме…
          </p>
        )}
        <div className="flex items-end gap-2">
          <input
            id="fm-files"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="peer sr-only"
            disabled={full || sending}
            onChange={(e) => {
              if (e.target.files?.length) void addPhotos(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
          <label
            htmlFor="fm-files"
            title="Прикачи снимка"
            className={`btn btn-outline size-11 shrink-0 cursor-pointer p-0 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink ${full || sending ? "pointer-events-none opacity-50" : ""}`}
          >
            <ImagePlus className="size-5" aria-hidden />
            <span className="sr-only">Прикачи снимка</span>
          </label>
          <label htmlFor="fm-body" className="sr-only">
            Съобщение
          </label>
          <textarea
            id="fm-body"
            ref={field}
            name="body"
            rows={1}
            maxLength={4000}
            value={body}
            disabled={sending}
            onChange={(e) => {
              setBody(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && enterSends()) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder={`Здравейте! Трябва ми… Адресът е в … Удобно ли ви е${date ? ` ${relativeDay(date, today)}` : ""}?`}
            className="field max-h-40 min-h-11 resize-none py-2.5"
            enterKeyHint="enter"
            aria-invalid={Boolean(shownError)}
            aria-describedby={shownError ? "fm-err" : "fm-hint"}
          />
          <button
            type="submit"
            className="btn btn-rule size-11 shrink-0 p-0"
            disabled={sending || uploading}
            aria-label={sending ? "Изпращаме…" : "Изпрати съобщение"}
            title="Изпрати съобщение"
          >
            {sending ? (
              <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none" aria-hidden />
            ) : (
              <SendHorizontal className="size-5" aria-hidden />
            )}
          </button>
        </div>
        <p id="fm-hint" className="mb-3 mt-1 text-xs text-ink-3">
          Телефонът ви остава скрит, освен ако не го напишете.
        </p>
      </div>

      {sheet && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end">
          <button type="button" aria-label="Затвори" tabIndex={-1} className="min-h-0 flex-1 cursor-default bg-ink/25" onClick={closeSheet} />
          <div
            ref={sheetBox}
            tabIndex={-1}
            role="dialog"
            aria-label={sheet === "date" ? "Дата" : sheet === "work" ? "Каква работа" : "Помогнете на майстора да даде цена"}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                closeSheet();
              }
              // Enter in a field of a sheet must not send the message
              if (e.key === "Enter" && e.target instanceof HTMLInputElement) e.preventDefault();
            }}
            className="max-h-[85%] shrink-0 overflow-y-auto rounded-t-[14px] bg-surface px-4 pb-4 pt-2 shadow-[var(--shadow-lg)] outline-none [overscroll-behavior:contain]"
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold">
                {sheet === "date" && (
                  <>
                    Дата <span className="font-normal text-ink-3">(по желание)</span>
                  </>
                )}
                {sheet === "work" && "Каква работа"}
                {sheet === "price" && "Помогнете на майстора да даде цена"}
              </h2>
              <button type="button" className="btn btn-ghost min-h-11 shrink-0" onClick={closeSheet}>
                Готово
              </button>
            </div>
            {sheet === "date" && (
              <div>
                <DateField id="fm-date" min={today} value={date ?? ""} onChange={(v) => onDate(v || null)} ariaLabel="Дата" />
                {date && (
                  <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Част от деня">
                    {SLOT_DEFS.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        className="chip min-h-11"
                        aria-pressed={slot === s.key}
                        onClick={() => onSlot(slot === s.key ? null : s.key)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
                {date && (
                  <p className="hint">
                    {slot ? `Предпочитано: ${slotLabel(slot)}. ` : ""}
                    {busyDay ? "Отбелязан като зает: питайте дали може. " : ""}
                    Майсторът потвърждава деня в чата.{" "}
                    <button type="button" className="underline" onClick={() => onDate(null)}>
                      Без конкретна дата
                    </button>
                  </p>
                )}
              </div>
            )}
            {sheet === "work" && (
              <div className="grid gap-1">
                <WorkRow
                  label="Не е задължително"
                  on={!work}
                  muted
                  onPick={() => {
                    setWork("");
                    closeSheet();
                  }}
                />
                {priced.length > 0 && <p className="mt-1 px-3 text-xs font-bold text-ink-3">От ценоразписа</p>}
                {priced.map((o) => (
                  <WorkRow
                    key={o.value}
                    label={o.label}
                    on={work === o.value}
                    onPick={() => {
                      setWork(o.value);
                      closeSheet();
                    }}
                  />
                ))}
                {other.length > 0 && <p className="mt-1 px-3 text-xs font-bold text-ink-3">{priced.length ? "Други (цена в чата)" : "Услуги"}</p>}
                {other.map((o) => (
                  <WorkRow
                    key={o.value}
                    label={o.label}
                    on={work === o.value}
                    onPick={() => {
                      setWork(o.value);
                      closeSheet();
                    }}
                  />
                ))}
              </div>
            )}
            {sheet === "price" && (
              <div className="grid gap-3">
                {cats.length > 1 && (
                  <div>
                    <label htmlFor="fm-q-cat" className="label">
                      Вид работа
                    </label>
                    <select
                      id="fm-q-cat"
                      className="field"
                      value={catSlug}
                      onChange={(e) => {
                        setCatSlug(e.target.value);
                        setAnswers({});
                      }}
                    >
                      {cats.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {questions.map((q) => (
                  <div key={q.id}>
                    <label htmlFor={`fm-q-${q.id}`} className="label">
                      {q.label}
                    </label>
                    {q.options ? (
                      <select
                        id={`fm-q-${q.id}`}
                        className="field"
                        value={answers[q.id] ?? ""}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      >
                        <option value="">Не е задължително</option>
                        {q.options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={`fm-q-${q.id}`}
                        className="field"
                        maxLength={160}
                        value={answers[q.id] ?? ""}
                        placeholder={q.placeholder}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn btn-rule btn-sm min-h-11 justify-self-start"
                  disabled={!composed}
                  onClick={() => {
                    setBody((b) => (b.trim() ? `${b.trim()}\n\n${composed}` : composed));
                    setError("");
                    setAnswers({});
                    closeSheet();
                  }}
                >
                  Добави към съобщението
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </form>
  );
}

function WorkRow({ label, on, onPick, muted = false }: { label: string; on: boolean; onPick: () => void; muted?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      className={`flex min-h-11 items-center justify-between gap-2 rounded-[6px] px-3 text-left ${on ? "bg-rule-soft font-bold" : "hover:bg-paper"} ${muted ? "text-ink-2" : ""}`}
    >
      {label}
      {on && <Check className="size-4 shrink-0" aria-hidden />}
    </button>
  );
}
