/** Two-column auth layout: form on paper, a plain side column (under the form on phones). */
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
      {aside && <aside className="relative self-start lg:sticky lg:top-24">{aside}</aside>}
    </div>
  );
}
