"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { setDemoPlan } from "@/app/actions/demo";
import type { FormState } from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "@/components/submit-button";

/** DEMO ONLY button (shown only when the server has DEMO_PRO_BUTTON=1): Pro on or off for your own account. */
export function DemoProButton({ isPro }: { isPro: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(setDemoPlan, {});
  return (
    <form action={action} className="flex flex-col gap-3 rounded-[10px] border border-dashed border-ink bg-rule-soft p-4 sm:flex-row sm:items-center sm:p-5">
      <Sparkles className="size-7 shrink-0" strokeWidth={1.75} aria-hidden />
      <div className="flex-1">
        <p className="text-lg font-extrabold">Демо версия</p>
        <p className="text-[0.95rem] text-ink-2">
          {isPro ? "Pro е включен за твоя акаунт. Можеш да го върнеш, за да видиш и безплатния план." : "Включи Pro без плащане, за да опиташ оферти, тетрадка с клиенти, статистика и всичко друго."}
        </p>
        <FormMessage state={state} />
      </div>
      <input type="hidden" name="plan" value={isPro ? "free" : "pro"} />
      <SubmitButton className={isPro ? "btn btn-outline" : "btn btn-primary"} pendingText="Момент…">
        {isPro ? "Върни безплатния план" : "Активирай Pro"}
      </SubmitButton>
    </form>
  );
}
