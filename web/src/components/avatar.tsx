import { initials } from "@/lib/format";

// Deterministic monogram colors from the rule world (enamel, ink, brass, green)
const PAIRS = [
  ["var(--rule)", "var(--ink)"],
  ["var(--ink)", "var(--rule)"],
  ["var(--free)", "#fff"],
  ["#e7d9b8", "var(--ink)"],
  ["var(--brass)", "#fff"],
  ["#d9e2ea", "var(--ink)"],
];

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.codePointAt(0)!) | 0;
  return Math.abs(h);
}

export function Avatar({
  name,
  url,
  size = 48,
  className = "",
  square = false,
}: {
  name: string;
  url?: string | null;
  size?: number;
  className?: string;
  square?: boolean;
}) {
  const radius = square ? "rounded-[8px]" : "rounded-full";
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className={`${radius} shrink-0 object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  const [bg, fg] = PAIRS[hash(name) % PAIRS.length];
  return (
    <span
      aria-hidden
      className={`${radius} numerals grid shrink-0 place-items-center font-black ${className}`}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.42 }}
    >
      {initials(name) || "М"}
    </span>
  );
}
