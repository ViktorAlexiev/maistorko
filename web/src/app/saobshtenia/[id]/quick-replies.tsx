"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const DEFAULTS = ["Идвам утре в 10", "Прати снимка на проблема", "Цената е от … до …", "Кога ти е удобно?"];

type Own = { id: string; body: string };

/**
 * Craftsman only: ready-made answers above the composer. A tap puts the text in the composer (it is not sent),
 * so "…" can be filled in. The craftsman can save the current text as his own quick reply.
 */
export function QuickReplies({ me, current, onPick }: { me: string; current: string; onPick: (text: string) => void }) {
  const supabase = createClient();
  const [own, setOwn] = useState<Own[]>([]);
  const [edit, setEdit] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase
      .from("quick_replies")
      .select("id, body")
      .eq("craftsman_id", me)
      .order("created_at")
      .then(({ data }) => alive && data && setOwn(data));
    return () => {
      alive = false;
    };
  }, [supabase, me]);

  async function saveCurrent() {
    const body = current.trim();
    if (!body) return void toast.message("Напиши текст в полето и после го запази като бърз отговор.");
    const { data, error } = await supabase.from("quick_replies").insert({ craftsman_id: me, body }).select("id, body").single();
    if (error || !data) return void toast.error(error?.message || "Не успяхме да запазим.");
    setOwn((x) => [...x, data]);
    toast.success("Запазено като бърз отговор.");
  }

  async function remove(id: string) {
    const { error } = await supabase.from("quick_replies").delete().eq("id", id);
    if (error) return void toast.error("Не успяхме да изтрием.");
    setOwn((x) => x.filter((r) => r.id !== id));
  }

  return (
    <div
      aria-label="Бързи отговори"
      className="mx-auto mb-2 flex max-w-2xl items-center gap-1.5 overflow-x-auto pr-8 [-ms-overflow-style:none] [mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {DEFAULTS.map((t) => (
        <button key={t} type="button" className="chip shrink-0 whitespace-nowrap" onClick={() => onPick(t)}>
          {t}
        </button>
      ))}
      {own.map((r) => (
        <span key={r.id} className="inline-flex shrink-0 items-center">
          <button type="button" className="chip whitespace-nowrap bg-rule-soft" onClick={() => onPick(r.body)} title={r.body}>
            {r.body}
          </button>
          {edit && (
            <button type="button" className="grid size-10 place-items-center text-danger" onClick={() => remove(r.id)} aria-label={`Изтрий „${r.body}“`}>
              <X className="size-4" aria-hidden />
            </button>
          )}
        </span>
      ))}
      <button
        type="button"
        className="inline-flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 text-sm font-bold text-ink-2 hover:bg-paper"
        onClick={saveCurrent}
        title="Запази написаното като бърз отговор"
      >
        <Plus className="size-3.5" aria-hidden /> Запази
      </button>
      {own.length > 0 && (
        <button type="button" className="min-h-10 shrink-0 whitespace-nowrap px-2 text-sm text-ink-3 underline" onClick={() => setEdit((v) => !v)}>
          {edit ? "Готово" : "Промени"}
        </button>
      )}
    </div>
  );
}
