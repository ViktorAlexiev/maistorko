"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, X } from "lucide-react";
import { deleteAccount } from "@/app/actions/account";
import type { FormState } from "@/app/actions/auth";
import { FormMessage } from "@/components/submit-button";

const CONFIRM_WORD = "ИЗТРИЙ";

const DELETED = [
  "Профилът ти със снимките и цените",
  "Разговорите с клиентите",
  "Поръчките и офертите",
  "Отзивите за теб и отзивите, които си написал",
];

const DELETED_CLIENT = [
  "Профилът ти",
  "Разговорите с майсторите",
  "Отзивите, които си написал",
  "Снимките, които си пратил в чата",
  "Запазените майстори",
];

/** The red button: grey until the word is typed exactly, and busy while the account is being removed. */
function ConfirmButton({ ready }: { ready: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn bg-danger text-white hover:bg-[#912018] disabled:bg-surface-2 disabled:text-ink-3 disabled:opacity-100"
      disabled={!ready || pending}
      aria-disabled={!ready || pending}
    >
      {pending && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
      {pending ? "Изтриваме…" : "Изтрий профила завинаги"}
    </button>
  );
}

/** The content of the popup. It is remounted every time the popup closes, so the word and any old error start clean. */
function DeleteForm({ onCancel, forClient }: { onCancel: () => void; forClient: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(deleteAccount, {});
  const [word, setWord] = useState("");
  return (
    <form
      action={action}
      className="grid max-h-[88dvh] gap-4 overflow-y-auto overscroll-contain p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="del-title" className="display text-4xl">
          Изтриване на профила
        </h2>
        <button
          type="button"
          className="btn btn-ghost btn-sm -mr-2 -mt-1 min-h-11 min-w-11 px-0"
          onClick={onCancel}
          aria-label="Затвори"
        >
          <X className="size-6" aria-hidden />
        </button>
      </div>
      <div>
        <p className="text-ink-2">Изтрива се завинаги и не може да се върне:</p>
        <ul className="mt-2 grid gap-1">
          {(forClient ? DELETED_CLIENT : DELETED).map((x) => (
            <li key={x} className="rounded-[6px] bg-paper px-3 py-2.5 font-semibold">
              {x}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-sm text-ink-2">
        Ако искаш да запазиш нещо, първо{" "}
        {/* a plain link: the browser downloads the file */}
        <a href="/tabla/profil/eksport" className="link font-bold text-ink" download>
          свали данните си
        </a>
        .
      </p>
      <div>
        <label htmlFor="del-confirm" className="label">
          За да потвърдиш, напиши {CONFIRM_WORD}
        </label>
        <input
          id="del-confirm"
          name="confirm"
          className="field"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={word}
          onChange={(e) => setWord(e.target.value)}
        />
      </div>
      <FormMessage state={state} />
      <div className="grid gap-2 sm:flex sm:flex-row-reverse">
        <ConfirmButton ready={word === CONFIRM_WORD} />
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Отказ
        </button>
      </div>
    </form>
  );
}

/** „Изтрий профила“ and the popup behind it: a sheet from the bottom on phones, a dialog in the middle on wider screens. */
export function DeleteAccount({ forClient = false }: { forClient?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  // Bumped on every close (Escape, Отказ, the backdrop, the cross), which remounts the form and clears it
  const [round, setRound] = useState(0);
  const close = () => ref.current?.close();
  return (
    <>
      <button
        type="button"
        className="btn btn-danger mt-3"
        onClick={() => {
          const dialog = ref.current;
          if (!dialog) return;
          dialog.showModal();
          dialog.querySelector<HTMLInputElement>("input[name=confirm]")?.focus();
        }}
      >
        Изтрий профила
      </button>
      <dialog
        ref={ref}
        className="sheet"
        aria-labelledby="del-title"
        onClose={() => setRound((n) => n + 1)}
        onClick={(e) => e.target === ref.current && close()}
      >
        <DeleteForm key={round} onCancel={close} forClient={forClient} />
      </dialog>
    </>
  );
}
