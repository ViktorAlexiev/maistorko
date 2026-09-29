"use client";

import Link from "next/link";
import { useTransition } from "react";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { confirmCalendar } from "@/app/actions/dashboard";

export function ConfirmCalendarBanner({ daysAgo, compact = false }: { daysAgo: number; compact?: boolean }) {
  const [pending, start] = useTransition();
  const urgent = daysAgo >= 14;
  return (
    <div
      className={`flex flex-col gap-3 rounded-[10px] p-4 sm:flex-row sm:items-center sm:p-5 ${
        urgent ? "bg-rule shadow-[inset_0_0_0_1.5px_var(--ink)]" : "border border-line bg-surface"
      }`}
    >
      <CalendarCheck className="size-7 shrink-0" strokeWidth={1.75} aria-hidden />
      <div className="flex-1">
        <p className="text-lg font-extrabold">
          {urgent ? "Потвърди графика си за следващата седмица" : "Графикът ти актуален ли е?"}
        </p>
        <p className="text-[0.95rem] text-ink-2">
          {daysAgo < 1
            ? "Потвърден днес."
            : `Последно потвърден преди ${Math.floor(daysAgo)} ${Math.floor(daysAgo) === 1 ? "ден" : "дни"}.`}{" "}
          {urgent
            ? "Докато не го потвърдиш, показваме те по-назад в търсенето."
            : "Потвърденият график те показва по-напред в търсенето."}
        </p>
      </div>
      <div className="flex gap-2">
        {!compact && (
          <Link href="/tabla/kalendar" className="btn btn-outline">
            Промени
          </Link>
        )}
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await confirmCalendar();
              if (res.ok) toast.success(res.message);
              else toast.error(res.message);
            })
          }
        >
          {pending ? "Потвърждаваме…" : "Всичко е вярно"}
        </button>
      </div>
    </div>
  );
}
