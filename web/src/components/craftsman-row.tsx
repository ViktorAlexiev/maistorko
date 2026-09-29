import Link from "next/link";
import { MapPin, Zap } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Rating, VerifiedBadge } from "@/components/bits";
import { RuleStrip } from "@/components/rule-strip";
import { headlinePrice, relativeDay, type PriceUnit } from "@/lib/format";

export type CraftsmanCardData = {
  id: string;
  slug: string;
  display_name: string;
  business_name: string | null;
  avatar_url: string | null;
  city_name: string | null;
  category_names: string[] | null;
  price_from: number | null;
  price_from_unit: PriceUnit | null;
  quote_on_inspection: boolean;
  rating_avg: number;
  rating_count: number;
  is_verified: boolean;
  short_notice: boolean;
  years_experience: number | null;
  next_free: string | null;
  matched_date: string | null;
  strip: string | null;
  freshness: string;
};

/** A catalog row: who, what, how much, and the folding rule of the next 14 days. */
export function CraftsmanRow({
  c,
  dateQuery,
  compact = false,
}: {
  c: CraftsmanCardData;
  dateQuery?: string;
  compact?: boolean;
}) {
  const href = `/maistori/${c.slug}${dateQuery ? `?data=${dateQuery}` : ""}`;
  const free = c.matched_date ?? c.next_free;
  const price = headlinePrice(c.price_from, c.price_from_unit, c.quote_on_inspection);
  const cats = (c.category_names ?? []).slice(0, 3);

  return (
    <article className="group relative rounded-[10px] border border-line bg-surface transition-[border-color,box-shadow] duration-200 hover:border-ink/40 hover:shadow-[var(--shadow-md)]">
      <div className={`grid gap-x-5 gap-y-4 p-4 sm:p-5 ${compact ? "" : "lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]"}`}>
        <div className="flex min-w-0 gap-4">
          <Avatar name={c.display_name} url={c.avatar_url} size={compact ? 52 : 64} square />
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-1.5 text-lg font-extrabold leading-tight">
              <Link href={href} className="after:absolute after:inset-0 after:content-[''] sm:truncate">
                {c.display_name}
              </Link>
              {c.is_verified && <VerifiedBadge />}
            </h3>
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
            <p className="numerals mt-2 text-[1.6rem] leading-none sm:hidden">
              {price}
              {c.years_experience ? (
                <span className="ml-2 font-sans text-sm font-normal text-ink-3">{c.years_experience} г. опит</span>
              ) : null}
            </p>
          </div>
          <div className="hidden shrink-0 text-right sm:block">
            <p className={`numerals leading-none ${compact ? "text-[1.35rem] sm:text-[1.75rem]" : "text-[1.5rem] sm:text-[2rem]"}`}>{price}</p>
            {c.years_experience ? (
              <p className="mt-1 text-sm text-ink-3">{c.years_experience} г. опит</p>
            ) : null}
          </div>
        </div>

        <div className="min-w-0">
          {c.strip ? (
            <>
              <RuleStrip strip={c.strip} size={compact ? "sm" : "md"} />
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {free ? (
                  <span className="font-bold text-free">
                    Свободен {relativeDay(free)}
                    {c.matched_date ? " (търсената дата)" : ""}
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
