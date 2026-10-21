"use client";

import { useActionState } from "react";
import { Download } from "lucide-react";
import { deleteAccount } from "@/app/actions/account";
import type { FormState } from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "@/components/submit-button";

/** GDPR: download everything we hold about you, or delete the account for good. */
export function MyData() {
  const [state, action] = useActionState<FormState, FormData>(deleteAccount, {});
  return (
    <section aria-labelledby="mydata-heading" className="grid gap-5 rounded-[10px] border border-line bg-surface p-4 sm:p-5">
      <div>
        <h2 id="mydata-heading" className="text-xl font-extrabold">
          Твоите данни
        </h2>
        <p className="mt-1 text-ink-2">Можеш да свалиш всичко, което пазим за теб, или да изтриеш профила си.</p>
      </div>

      <div>
        {/* a plain link: the browser downloads the file */}
        <a href="/tabla/profil/eksport" className="btn btn-outline" download>
          <Download className="size-4" aria-hidden /> Свали данните ми (JSON)
        </a>
      </div>

      <form action={action} className="grid gap-3 border-t border-line pt-5">
        <h3 className="font-extrabold text-danger">Изтриване на профила</h3>
        <p className="text-sm text-ink-2">
          Профилът, разговорите, поръчките, офертите и отзивите, които си написал, се изтриват завинаги и не могат да се върнат.
          Отзивите, които други са написали за теб, също се изтриват. Сваляй данните си преди това.
        </p>
        <div className="max-w-xs">
          <label htmlFor="del-confirm" className="label">
            За да потвърдиш, напиши ИЗТРИЙ
          </label>
          <input id="del-confirm" name="confirm" className="field" autoComplete="off" />
        </div>
        <FormMessage state={state} />
        <div>
          <SubmitButton className="btn border border-danger text-danger hover:bg-danger-soft" pendingText="Изтриваме…">
            Изтрий профила ми завинаги
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}
