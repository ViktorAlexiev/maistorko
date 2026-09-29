import { RuleMark } from "@/components/logo";

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
      <aside aria-hidden={!aside} className="relative hidden overflow-hidden rounded-[14px] bg-rule p-10 lg:block">
        <div className="graduations graduations-top absolute inset-x-0 top-0 h-4" />
        <RuleMark className="h-10 w-20" />
        {aside}
      </aside>
    </div>
  );
}
