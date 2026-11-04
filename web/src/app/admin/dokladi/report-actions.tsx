"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";
import { resolveReports, setBanned, setHidden } from "@/app/actions/admin";

export function ReportActions({ userId, isCraftsman, hidden, banned }: { userId: string; isCraftsman: boolean; hidden: boolean; banned: boolean }) {
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();
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
    <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
      {isCraftsman && (
        <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => act(() => setHidden(userId, !hidden))}>
          {hidden ? "Покажи профила" : "Скрий профила"}
        </button>
      )}
      <button
        type="button"
        className={`btn btn-sm ${banned ? "btn-outline" : "btn-danger"}`}
        disabled={pending}
        onClick={async () => {
          if (!banned && !(await confirm({ title: "Да блокирам ли този потребител?", message: "Няма да може да пише, а профилът му ще се скрие.", confirmLabel: "Блокирай", danger: true }))) return;
          act(() => setBanned(userId, !banned));
        }}
      >
        {banned ? "Отблокирай" : "Блокирай"}
      </button>
      <span className="flex-1" />
      <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => act(() => resolveReports(userId, "done"))}>
        Приключи докладите
      </button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={() => act(() => resolveReports(userId, "dismissed"))}>
        Отхвърли
      </button>
      {dialog}
    </div>
  );
}
