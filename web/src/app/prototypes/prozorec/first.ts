"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_ATTACHMENTS } from "@/app/saobshtenia/[id]/chat-photos";
import { checkImage } from "@/components/image-upload";
import { composeAnswers, questionsFor } from "@/lib/inquiry-questions";
import { slotLabel, type Slot } from "@/lib/slots";
import { BUSY_DAYS, CRAFTSMAN, DEMO_BODY, DEMO_PHOTOS, dateLabel, workLabel, workPrice, type Scenario, type SentData } from "./data";

/** The state of the first message, used by „Като в разговора“: today's fields plus the photos. */

export type PhotoItem = { key: string; src: string; demo: boolean; uploading: boolean };

/** Photos picked for the message: real files with object-URL previews, at most four, each „качва се“ for a moment. */
function usePhotos(initial: PhotoItem[]) {
  const [items, setItems] = useState(initial);
  const [note, setNote] = useState("");
  const urls = useRef<string[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    const t = timers.current;
    const u = urls.current;
    // the demo photo of „Със снимки“ is still uploading when the page opens; it finishes a bit later
    if (initial.some((p) => p.uploading)) {
      t.push(setTimeout(() => setItems((xs) => xs.map((x) => (x.demo ? { ...x, uploading: false } : x))), 9000));
    }
    return () => {
      t.forEach(clearTimeout);
      u.forEach((x) => URL.revokeObjectURL(x));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function add(files: File[]) {
    const ok: File[] = [];
    let problem = "";
    for (const f of files) {
      const p = checkImage(f, 5);
      if (p) problem = problem || p;
      else ok.push(f);
    }
    const take = ok.slice(0, Math.max(MAX_ATTACHMENTS - items.length, 0));
    if (ok.length > take.length) problem = `Най-много ${MAX_ATTACHMENTS} снимки в едно съобщение. Останалите не са добавени.`;
    setNote(problem);
    if (!take.length) return;
    const fresh: PhotoItem[] = take.map((file) => {
      const src = URL.createObjectURL(file);
      urls.current.push(src);
      return { key: `p${++seq.current}`, src, demo: false, uploading: true };
    });
    setItems((xs) => [...xs, ...fresh]);
    timers.current.push(setTimeout(() => setItems((xs) => xs.map((x) => (fresh.some((f) => f.key === x.key) ? { ...x, uploading: false } : x))), 1400));
  }

  function remove(key: string) {
    setNote("");
    setItems((xs) => xs.filter((x) => x.key !== key));
  }

  return { items, note, add, remove, full: items.length >= MAX_ATTACHMENTS };
}

const clock = () => new Date().toLocaleTimeString("bg-BG", { hour: "2-digit", minute: "2-digit" });

export function useFirst(scenario: Scenario, onSent: (s: SentData) => void) {
  const filled = scenario === 2;
  const [date, setDateState] = useState(filled ? "2026-11-19" : "");
  const [slot, setSlot] = useState<Slot | null>(filled ? "morning" : null);
  const [work, setWork] = useState(filled ? "s:mesitel" : "");
  const [body, setBodyState] = useState(filled ? DEMO_BODY : "");
  const [error, setError] = useState("");
  const [catSlug, setCatSlugState] = useState(CRAFTSMAN.categories[0].slug);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [askOpen, setAskOpen] = useState(false);
  const [pending, setPending] = useState<SentData | null>(null);
  const photos = usePhotos(
    filled
      ? DEMO_PHOTOS.map((src, i) => ({ key: `d${i}`, src, demo: true, uploading: i === DEMO_PHOTOS.length - 1 }))
      : [],
  );
  const questions = questionsFor(catSlug);
  const composed = composeAnswers(questions, answers);
  const uploading = photos.items.some((p) => p.uploading);

  // „Изпращаме…“ waits for photos that are still uploading, then the first message becomes the conversation
  useEffect(() => {
    if (!pending || uploading) return;
    const t = setTimeout(() => onSent(pending), 700);
    return () => clearTimeout(t);
  }, [pending, uploading, onSent]);

  return {
    date,
    slot,
    setSlot,
    setDate: (v: string) => {
      setDateState(v);
      if (!v) setSlot(null);
    },
    busyDay: BUSY_DAYS.includes(date),
    work,
    setWork,
    body,
    setBody: (v: string) => {
      setBodyState(v);
      setError("");
    },
    error,
    catSlug,
    setCatSlug: (v: string) => {
      setCatSlugState(v);
      setAnswers({});
    },
    questions,
    answers,
    setAnswer: (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v })),
    composed,
    askOpen,
    setAskOpen,
    addAnswers: () => {
      setBodyState((b) => (b.trim() ? `${b.trim()}\n\n${composed}` : composed));
      setError("");
      setAnswers({});
      setAskOpen(false);
    },
    photos,
    sending: pending !== null,
    /** false when the message is empty (the error shows) */
    send: () => {
      if (pending) return false;
      if (!body.trim()) {
        setError("Напишете съобщение.");
        return false;
      }
      setError("");
      setPending({
        body: body.trim(),
        label: date ? dateLabel(date, slot) : undefined,
        slot: date && slot ? (slotLabel(slot) ?? undefined) : undefined,
        work: work ? workLabel(work) : undefined,
        workPrice: work ? workPrice(work) : undefined,
        photos: photos.items.map((p) => ({ src: p.src, demo: p.demo })),
        time: clock(),
      });
      return true;
    },
  };
}

export type First = ReturnType<typeof useFirst>;
