import { RuleMark } from "@/components/logo";
import { RuleStrip } from "@/components/rule-strip";

/** Two-column auth layout: form on paper, a yellow rule field beside it. */
export function AuthShell({
  title,
  intro,
  children,
  aside,
}: {
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,28rem)_1fr] lg:gap-16">
      <div>
        <h1 className="display text-5xl sm:text-6xl">{title}</h1>
        {intro && <div className="mt-3 text-lg text-ink-2">{intro}</div>}
        <div className="mt-8">{children}</div>
      </div>
      <aside aria-hidden={!aside} className="relative hidden min-h-[28rem] overflow-hidden rounded-[14px] bg-rule p-10 lg:flex lg:flex-col lg:justify-between">
        <div className="graduations graduations-top absolute inset-x-0 top-0 h-4" />
        <div>
          <RuleMark className="h-10 w-20" />
          {aside}
        </div>
        {/* A sample of what a craftsman's free days look like, so the yellow field is never just empty */}
        <div className="mt-10">
          <RuleStrip strip="FFPFBBFFFPFFBB" size="lg" label="Пример: свободни дни" />
          <p className="mt-3 max-w-sm text-sm font-semibold">Така клиентите виждат кога един майстор е свободен.</p>
        </div>
      </aside>
    </div>
  );
}
