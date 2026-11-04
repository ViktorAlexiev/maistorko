"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
  /** the question, e.g. "Да отменя ли уговорката?" */
  title: string;
  /** what happens next, one short sentence */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** red confirm button for things that cannot be undone */
  danger?: boolean;
};

type Pending = Options & { resolve: (ok: boolean) => void };

/**
 * Our own confirmation window instead of the browser's `window.confirm`.
 *
 *   const { confirm, dialog } = useConfirm();
 *   ...
 *   if (!(await confirm({ title: "Да изтрия ли?", danger: true }))) return;
 *   ...
 *   return <>{...}{dialog}</>;
 */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback((options: Options) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })), []);
  const answer = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );
  const dialog = pending ? <ConfirmDialog options={pending} onAnswer={answer} /> : null;
  return { confirm, dialog };
}

function ConfirmDialog({ options, onAnswer }: { options: Options; onAnswer: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      aria-describedby={options.message ? "confirm-text" : undefined}
      // Esc and a click on the dim background count as "no"
      onCancel={(e) => {
        e.preventDefault();
        onAnswer(false);
      }}
      onClick={(e) => e.target === ref.current && onAnswer(false)}
      className="m-auto w-[min(92vw,24rem)] rounded-[14px] border-[1.5px] border-ink bg-paper p-0 text-ink shadow-[var(--shadow-lg)] backdrop:bg-ink/50"
    >
      <div className="grid gap-4 p-5">
        <div>
          <h2 id="confirm-title" className="text-xl font-extrabold leading-snug">
            {options.title}
          </h2>
          {options.message && (
            <p id="confirm-text" className="mt-1.5 text-ink-2">
              {options.message}
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn btn-outline" autoFocus onClick={() => onAnswer(false)}>
            {options.cancelLabel ?? "Не"}
          </button>
          <button
            type="button"
            className={options.danger ? "btn border border-danger bg-danger text-white hover:bg-danger/90" : "btn btn-primary"}
            onClick={() => onAnswer(true)}
          >
            {options.confirmLabel ?? "Да"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
