import Link from "next/link";
import { Lock } from "lucide-react";

/** "5 от 8" and, at the limit, a short pointer to Pro. Shown only when the plan has a limit. */
export function LimitNote({ used, limit, what }: { used: number; limit: number | null | undefined; what: string }) {
  if (limit == null) return null;
  const full = used >= limit;
  return (
    <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-sm ${full ? "font-semibold text-ink" : "text-ink-3"}`}>
      {full && <Lock className="size-4 shrink-0" aria-hidden />}
      <span className="tabular">
        {used} от {limit} {what}
      </span>
      {full && (
        <span>
          Безплатният план е стигнал лимита.{" "}
          <Link href="/tabla/plan" className="link font-bold">
            Виж Pro
          </Link>
        </span>
      )}
    </p>
  );
}
