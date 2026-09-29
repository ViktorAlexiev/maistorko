"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { setBanned, setHidden, setVerified } from "@/app/actions/admin";

export function UserActions({
  id,
  isAdmin,
  isCraftsman,
  banned,
  verified,
  hidden,
}: {
  id: string;
  isAdmin: boolean;
  isCraftsman: boolean;
  banned: boolean;
  verified: boolean;
  hidden: boolean;
}) {
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean; message: string }>) =>
    start(async () => {
      try {
        const r = await fn();
        if (r.ok) toast.success(r.message);
        else toast.error(r.message);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Неуспешно.");
      }
    });

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {isCraftsman && (
        <>
          <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => act(() => setVerified(id, !verified))}>
            {verified ? "Махни „Проверен“" : "Маркирай като проверен"}
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => act(() => setHidden(id, !hidden))}>
            {hidden ? "Покажи" : "Скрий"}
          </button>
        </>
      )}
      {!isAdmin && (
        <button
          type="button"
          className={`btn btn-sm ${banned ? "btn-outline" : "btn-danger"}`}
          disabled={pending}
          onClick={() => {
            if (!banned && !window.confirm("Да блокирам ли този потребител? Няма да може да пише, а профилът му ще се скрие.")) return;
            act(() => setBanned(id, !banned));
          }}
        >
          {banned ? "Отблокирай" : "Блокирай"}
        </button>
      )}
    </div>
  );
}
