import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

export type FirstStep = {
  key: "kakvo" | "tseni" | "koga" | "za-men" | "snimki";
  /** One word on the meter's part */
  short: string;
  /** How the step is named after „Липсва:“ (only the three the search needs) */
  missing?: string;
  /** Needed for the profile to show in search */
  required: boolean;
  done: boolean;
  href: string;
};

export function firstSteps(s: {
  hasCategory: boolean;
  hasPrice: boolean;
  hasSchedule: boolean;
  bioDone: boolean;
  hasPhoto: boolean;
}): FirstStep[] {
  return [
    { key: "kakvo", short: "Работа", missing: "какво работиш", required: true, done: s.hasCategory, href: "/setap?stapka=1" },
    { key: "tseni", short: "Цени", missing: "цени", required: true, done: s.hasPrice, href: "/setap?stapka=3" },
    { key: "koga", short: "График", missing: "кога си свободен", required: true, done: s.hasSchedule, href: "/setap?stapka=4" },
    { key: "za-men", short: "За теб", required: false, done: s.bioDone, href: "/tabla/profil?chast=za-men" },
    { key: "snimki", short: "Снимки", required: false, done: s.hasPhoto, href: "/tabla/snimki" },
  ];
}

/** „цени“, „цени и кога си свободен“, „какво работиш, цени и кога си свободен“ */
export function joinMissing(steps: FirstStep[]): string {
  const m = steps.filter((s) => s.required && !s.done).map((s) => s.missing!);
  return m.length <= 1 ? (m[0] ?? "") : `${m.slice(0, -1).join(", ")} и ${m[m.length - 1]}`;
}

/**
 * „Метър“: one short field. The five steps are the parts of the bar itself, each one a link;
 * the three the search needs stand apart from the two that are up to you.
 */
export function FirstSteps({ steps, listed }: { steps: FirstStep[]; listed: boolean }) {
  const missingRequired = steps.some((s) => s.required && !s.done);
  // Nothing required is missing, yet the profile is not listed (e.g. hidden by an admin): not in the search, so no „се вижда“
  const notListed = missingRequired || !listed;
  const done = steps.filter((s) => s.done).length;
  // The three the search needs come first, so the next step is always one of them while a required one is missing
  const next = steps.find((s) => !s.done) ?? steps[0];
  return (
    <section
      aria-labelledby="setup-heading"
      className="grid gap-x-6 gap-y-4 rounded-[10px] bg-surface p-4 [grid-template-areas:'text'_'meter'_'btn'] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5 sm:[grid-template-areas:'text_btn'_'meter_meter']"
    >
      <div className="[grid-area:text]">
        <div className="flex items-baseline gap-3">
          <h2 id="setup-heading" className="text-xl font-extrabold">
            Първи стъпки
          </h2>
          <p className="numerals text-2xl">
            {done}/{steps.length}
            <span className="sr-only"> готови</span>
          </p>
        </div>
        <p className="mt-1 text-ink-2">
          {missingRequired
            ? `Профилът ти още не се вижда в търсенето. Липсва: ${joinMissing(steps)}.`
            : !listed
              ? "Профилът ти е скрит от администратор и не се показва в търсенето."
              : "Профилът ти се вижда в търсенето. Останалото е по желание."}
        </p>
      </div>
      <Link href={next.href} className={`btn [grid-area:btn] ${notListed ? "btn-primary" : "btn-outline"}`}>
        Продължи: {next.short} <ArrowRight className="size-4" aria-hidden />
      </Link>
      <ol className="flex gap-1 [grid-area:meter]">
        {steps.map((s, i) => (
          <li key={s.key} className={`min-w-0 flex-1 ${i === 3 ? "ml-2 sm:ml-3" : ""}`}>
            <Link
              href={s.href}
              aria-current={s === next ? "step" : undefined}
              className={`flex min-h-16 flex-col justify-between gap-1 rounded-[6px] px-1.5 py-1.5 transition-colors motion-reduce:transition-none sm:px-2.5 ${
                s.done ? "bg-rule hover:bg-rule-deep" : "bg-paper hover:bg-surface-2"
              } ${s === next ? "shadow-[inset_0_0_0_2px_var(--ink)]" : ""}`}
            >
              {s.done ? (
                <Check className="size-4 text-ink" aria-hidden />
              ) : (
                <span className="numerals text-[1.05rem] leading-none text-ink-3">{i + 1}</span>
              )}
              <span className="display break-words text-[1.05rem] leading-none sm:text-[1.3rem]">
                {s.short}
                <span className="sr-only">{s.done ? " (готово)" : " (предстои)"}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
