"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setContactStatus } from "@/app/actions/admin";

const STATUSES = [
  ["new", "Ново"],
  ["talking", "В разговор"],
  ["done", "Приключено"],
  ["rejected", "Отказано"],
] as const;

export function RequestActions({ id, status, note }: { id: string; status: (typeof STATUSES)[number][0]; note: string }) {
  const [pending, start] = useTransition();
  const [text, setText] = useState(note);

  const save = (s: typeof status, n?: string) =>
    start(async () => {
      const r = await setContactStatus(id, s, n);
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    });

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Статус">
        {STATUSES.map(([key, label]) => (
          <button key={key} type="button" className="chip" aria-pressed={status === key} disabled={pending} onClick={() => save(key)}>
            {label}
          </button>
        ))}
      </div>
      <input
        className="field min-w-48 flex-1"
        placeholder="Бележка (виждат само админите)"
        value={text}
        maxLength={1000}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== note && save(status, text)}
        aria-label="Бележка"
      />
    </div>
  );
}
