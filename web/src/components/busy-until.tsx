"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { addDaysISO, formatDate } from "@/lib/format";

/** Marker note: the calendar treats this as an ordinary busy period, the profile and dashboard recognise it by it. */
export const BUSY_UNTIL_NOTE = "Заето до";

/**
 * "Заето до …" in one tap: vacation, sick leave, too much work. The days become busy in the calendar, so search,
 * the free-days strip and the ranking by availability all follow without any special case.
 */
export function BusyUntil({ userId, today, current }: { userId: string; today: string; current: { id: string; end_date: string } | null }) {
  const supabase = createClient();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [custom, setCustom] = useState("");

  function set(until: string) {
    start(async () => {
      await supabase.from("availability_exceptions").delete().eq("craftsman_id", userId).eq("note", BUSY_UNTIL_NOTE);
      const { error } = await supabase
        .from("availability_exceptions")
        .insert({ craftsman_id: userId, kind: "busy", start_date: today, end_date: until, note: BUSY_UNTIL_NOTE });
      if (error) return void toast.error("Не успяхме да запишем. Опитай пак.");
      toast.success(`Отбелязано: заето до ${formatDate(until)}.`);
      router.refresh();
    });
  }

  function clear() {
    start(async () => {
      const { error } = await supabase.from("availability_exceptions").delete().eq("craftsman_id", userId).eq("note", BUSY_UNTIL_NOTE);
      if (error) return void toast.error("Не успяхме да премахнем. Опитай пак.");
      toast.success("Вече си свободен по графика.");
      router.refresh();
    });
  }

  if (current) {
    return (
      <div className="flex flex-col gap-3 rounded-[10px] bg-rule p-4 shadow-[inset_0_0_0_1.5px_var(--ink)] sm:flex-row sm:items-center sm:p-5">
        <PauseCircle className="size-7 shrink-0" strokeWidth={1.75} aria-hidden />
        <p className="flex-1 text-lg font-extrabold">
          Заето до {formatDate(current.end_date)}
          <span className="block text-[0.95rem] font-normal text-ink-2">Клиентите виждат, че не приемаш работа през този период.</span>
        </p>
        <button type="button" className="btn btn-outline" disabled={pending} onClick={clear}>
          Свободен съм пак
        </button>
      </div>
    );
  }

  const week = [
    ["1 седмица", 7],
    ["2 седмици", 14],
    ["1 месец", 30],
  ] as const;
  return (
    <details className="rounded-[10px] border border-line bg-surface p-4">
      <summary className="flex cursor-pointer items-center gap-2 font-bold">
        <PauseCircle className="size-5" aria-hidden /> Почивка или претоварване? Отбележи „Заето до …“
      </summary>
      <p className="mt-2 text-sm text-ink-2">Спираш за нови запитвания за дните, които посочиш. Календарът ти остава непроменен.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {week.map(([label, n]) => (
          <button key={n} type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => set(addDaysISO(today, n))}>
            {label}
          </button>
        ))}
        <input type="date" className="field min-h-9 w-auto py-1 text-sm" min={addDaysISO(today, 1)} max={addDaysISO(today, 180)} value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Заето до дата" />
        <button type="button" className="btn btn-primary btn-sm" disabled={pending || !custom} onClick={() => set(custom)}>
          Запази
        </button>
      </div>
    </details>
  );
}
