export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10" aria-busy="true" aria-label="Зареждаме майсторите">
      <div className="skeleton mb-6 h-14 w-64" />
      <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10">
        <div className="hidden gap-4 lg:grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-16" />
          ))}
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-36" />
          ))}
        </div>
      </div>
    </div>
  );
}
