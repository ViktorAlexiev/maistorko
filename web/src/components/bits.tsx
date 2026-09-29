import { BadgeCheck, Star } from "lucide-react";

export function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  const full = Math.round(value * 2) / 2;
  return (
    <span className="inline-flex items-center" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="relative inline-block">
          <Star className={`${size} text-line-strong`} strokeWidth={1.5} />
          {full >= i - 0.5 && (
            <span className="absolute inset-0 overflow-hidden" style={{ width: full >= i ? "100%" : "50%" }}>
              <Star className={`${size} fill-ink text-ink`} strokeWidth={1.5} />
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

export function Rating({ avg, count, compact = false }: { avg: number; count: number; compact?: boolean }) {
  if (!count) return <span className="text-sm text-ink-3">Още няма отзиви</span>;
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`Рейтинг ${avg.toFixed(1)} от 5, ${count} отзива`}>
      <Stars value={avg} />
      <span className="numerals text-lg leading-none">{avg.toFixed(1).replace(".", ",")}</span>
      {!compact && <span className="text-sm text-ink-3">({count})</span>}
    </span>
  );
}

export function VerifiedBadge({ withLabel = false }: { withLabel?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 text-free"
      title="Проверен от екипа на Майсторко"
      aria-label="Проверен майстор"
    >
      <BadgeCheck className="size-[1.15em]" strokeWidth={2} aria-hidden />
      {withLabel && <span className="text-sm font-bold">Проверен</span>}
    </span>
  );
}

export function EmptyState({
  title,
  children,
  action,
  graphic = true,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  graphic?: boolean;
}) {
  return (
    <div className="rounded-[10px] border border-dashed border-line-strong bg-surface/60 px-6 py-12 text-center">
      {graphic && (
        <div aria-hidden className="mx-auto mb-5 flex h-9 w-44 overflow-hidden rounded-[5px] bg-rule ring-1 ring-inset ring-ink/35">
          {Array.from({ length: 7 }).map((_, i) => (
            <span key={i} className="relative flex-1">
              <span className="absolute left-0 top-0 h-3 w-px bg-ink" />
              <span className="absolute left-1/2 top-0 h-1.5 w-px bg-ink/60" />
            </span>
          ))}
        </div>
      )}
      <h3 className="display text-3xl">{title}</h3>
      {children && <div className="mx-auto mt-2 max-w-md text-ink-2">{children}</div>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function PageHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="display text-5xl sm:text-6xl">{title}</h1>
      {children && <div className="mt-3 max-w-2xl text-lg text-ink-2">{children}</div>}
    </div>
  );
}
