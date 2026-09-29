import Link from "next/link";

/** Folding-rule mark: two hinged yellow segments with graduations and a brass rivet. */
export function RuleMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 22" className={className} aria-hidden="true">
      <g transform="rotate(-8 22 11)">
        <rect x="1" y="6" width="21" height="10" rx="1.5" fill="var(--rule)" stroke="var(--ink)" strokeWidth="1.4" />
        <rect x="22" y="6" width="21" height="10" rx="1.5" fill="var(--rule)" stroke="var(--ink)" strokeWidth="1.4" />
        {[5, 9, 13, 17, 26, 30, 34, 38].map((x, i) => (
          <line key={x} x1={x} x2={x} y1="6.6" y2={i % 2 ? 9.5 : 11.5} stroke="var(--ink)" strokeWidth="1.2" />
        ))}
        <circle cx="22" cy="11" r="2.1" fill="var(--brass)" stroke="var(--ink)" strokeWidth="1" />
      </g>
    </svg>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2 ${className}`} aria-label="Майсторко, начало">
      <RuleMark className="h-6 w-12 transition-transform duration-300 ease-out group-hover:-rotate-3" />
      <span className="display text-[1.7rem] font-black leading-none tracking-[-0.01em]">Майсторко</span>
    </Link>
  );
}
