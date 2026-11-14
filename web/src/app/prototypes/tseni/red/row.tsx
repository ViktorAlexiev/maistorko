import Link from "next/link";
import { Handshake, MapPin, Zap } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Rating, VerifiedBadge } from "@/components/bits";
import { RuleStrip } from "@/components/rule-strip";
import { formatDate, relativeDay } from "@/lib/format";
import type { RedRow } from "./red-data";

/**
 * Local copy of components/craftsman-row.tsx, approved variant „Под цената“ (14 Nov 2026): a row whose price comes
 * from a service or subcategory matching the search text shows that price, and the name under it. Only the price/name
 * area differs from the real row.
 */
export function RedRowView({ c }: { c: RedRow }) {
  const href = `/maistori/${c.slug}`;
  const free = c.matched_date ?? c.next_free;
  const cats = (c.category_names ?? []).slice(0, 3);
  const m = c.match;
  const price = m ? m.price : c.headline;
  const years = c.years_experience ? `${c.years_experience} г. опит` : null;

  return (
    <article
      className={`group relative rounded-[10px] border bg-surface transition-[border-color,box-shadow] duration-200 hover:border-ink/40 hover:shadow-[var(--shadow-md)] ${
        c.is_pro ? "border-ink shadow-[inset_0_3px_0_var(--rule)]" : "border-line"
      }`}
    >
      <div className="grid gap-x-5 gap-y-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="flex min-w-0 gap-4">
          <Avatar name={c.display_name} url={c.avatar_url} size={64} square />
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-1.5 text-lg font-extrabold leading-tight">
              <Link href={href} className="after:absolute after:inset-0 after:content-[''] sm:truncate">
                {c.display_name}
              </Link>
              {c.is_verified && <VerifiedBadge />}
            </h3>
            {c.is_pro && (
              <p className="mt-0.5 inline-flex items-center gap-1 rounded bg-rule px-1.5 py-0.5 text-xs font-bold">
                <Handshake className="size-3.5" aria-hidden /> Платен бонус в класирането
              </p>
            )}
            {c.business_name && <p className="truncate text-sm text-ink-3">{c.business_name}</p>}
            <p className="mt-1 line-clamp-1 text-[0.95rem] text-ink-2">{cats.join(" · ")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
              {c.city_name && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden /> {c.city_name}
                </span>
              )}
              <Rating avg={Number(c.rating_avg)} count={c.rating_count} />
            </div>
            {/* phones: price sits under the name so the name never truncates */}
            {price && (
              <p className="numerals mt-2 text-[1.6rem] leading-none sm:hidden">
                {price}
                {years ? <span className="ml-2 font-sans text-sm font-normal text-ink-3">{years}</span> : null}
              </p>
            )}
            {m && <p className="mt-1 text-sm font-semibold text-ink-2 sm:hidden">{m.name}</p>}
          </div>
          <div className="hidden shrink-0 text-right sm:block">
            {price && <p className="numerals text-[1.5rem] leading-none sm:text-[2rem]">{price}</p>}
            {m && (
              <p className="ml-auto mt-1 max-w-[9rem] text-sm font-semibold leading-snug text-ink-2 line-clamp-2">{m.name}</p>
            )}
            {years ? <p className="mt-1 text-sm text-ink-3">{years}</p> : null}
          </div>
        </div>

        <div className="min-w-0">
          {c.strip ? (
            <>
              <RuleStrip strip={c.strip} size="md" />
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {free ? (
                  <span className="font-bold text-free">
                    {!c.strip.includes("F") && !c.strip.includes("P") && !c.matched_date
                      ? `Зает 2 седмици. Свободен от ${formatDate(free)}`
                      : `Свободен ${relativeDay(free)}${c.matched_date ? " (търсената дата)" : ""}`}
                  </span>
                ) : (
                  <span className="font-semibold text-ink-3">Няма свободни дни скоро</span>
                )}
                {c.short_notice && (
                  <span className="inline-flex items-center gap-1 font-semibold text-ink-2">
                    <Zap className="size-3.5" aria-hidden /> идва и в същия ден
                  </span>
                )}
                {c.freshness === "stale" && <span className="text-ink-3">графикът не е обновяван скоро</span>}
              </p>
            </>
          ) : (
            <p className="rounded-[6px] border border-dashed border-line-strong px-3 py-2.5 text-sm text-ink-3">
              Графикът не е потвърден отдавна. Попитайте за дата в чата.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
