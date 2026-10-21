"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export function OfferResponse({ token, validUntil }: { token: string; validUntil: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");

  function answer(accept: boolean) {
    if (accept && !name.trim()) return void toast.error("Напишете името си, за да приемете.");
    start(async () => {
      const { error } = await supabase.rpc("respond_offer", { p_token: token, p_accept: accept, p_name: name.trim() || undefined });
      if (error) return void toast.error(error.message);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-3 rounded-[10px] border border-line bg-surface p-4 sm:p-5">
      <div>
        <label htmlFor="of-name" className="label">Вашето име</label>
        <input id="of-name" className="field" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" className="btn btn-primary" disabled={pending} onClick={() => answer(true)}>
          Приемам офертата
        </button>
        <button type="button" className="btn btn-outline" disabled={pending} onClick={() => answer(false)}>
          Отказвам
        </button>
      </div>
      <p className="text-sm text-ink-3">Офертата важи до {validUntil}.</p>
    </div>
  );
}
