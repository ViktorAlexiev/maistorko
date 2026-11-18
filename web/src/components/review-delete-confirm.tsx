"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

/** Steps of „Изтрий моя отзив“: the button row is replaced by a confirm row; focus goes to „Отказ“ and back to the delete button. */
export function useDeleteConfirm() {
  const [confirming, setConfirming] = useState(false);
  const deleteRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (!confirming && refocus.current) {
      refocus.current = false;
      deleteRef.current?.focus();
    }
  }, [confirming]);
  return {
    confirming,
    deleteRef,
    ask: () => setConfirming(true),
    cancel: () => {
      refocus.current = true;
      setConfirming(false);
    },
  };
}

/** The in-place confirm row. Inside a form it also stays disabled while the form's action runs. */
export function DeleteConfirm({
  canWriteAgain,
  busy = false,
  onCancel,
  confirm,
}: {
  /** false when the client could not write a new review afterwards: then the second sentence warns about it */
  canWriteAgain: boolean;
  busy?: boolean;
  onCancel: () => void;
  /** the „Да, изтрий“ button, built by the caller; it gets `disabled` from here */
  confirm: (disabled: boolean) => React.ReactNode;
}) {
  const { pending } = useFormStatus();
  const disabled = busy || pending;
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);
  return (
    <div role="group" aria-label="Изтриване на отзива">
      <p className="leading-snug">
        Да изтрием ли отзива? Това не може да се върне.{!canWriteAgain && " След това няма да можете да оставите нов отзив."}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {confirm(disabled)}
        <button ref={cancelRef} type="button" className="btn btn-ghost" onClick={onCancel} disabled={disabled}>
          Отказ
        </button>
      </div>
    </div>
  );
}
