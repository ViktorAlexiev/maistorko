import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Check, Clock, Info, Languages, MapPin, MessageCircle, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { photoUrl } from "@/lib/data";
import {
  daysSince,
  formatEur,
  headlinePrice,
  LANGUAGE_LABEL,
  servicePrice,
  timeAgo,
  todayISO,
  type PriceKind,
  type PriceUnit,
} from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { Rating, Stars, VerifiedBadge } from "@/components/bits";
import { ProfileBooking, type DayInfo } from "@/components/profile-booking";
import { OpenChatButton, type WorkOption } from "@/components/chat-dock";
import { PhoneReveal } from "@/components/phone-reveal";
import { SaveButton } from "@/components/save-button";
import { Gallery } from "@/components/gallery";
import { ReviewForm } from "@/components/review-form";
import { deleteReview } from "@/app/actions/engage";

/** PostgREST self-joins may come back as an object or a one-element array. */
function one<T>(x: T | T[] | null | undefined): T | null {
  return Array.isArray(x) ? (x[0] ?? null) : (x ?? null);
}

const getCraftsman = cache(async (slug: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("craftsman_profiles")
    .select(
      `id, slug, display_name, business_name, bio, years_experience, languages, avatar_url,
       hourly_rate, callout_fee, travel_fee, materials_included, quote_on_inspection,
       inspection_policy, inspection_fee, terms_note, other_services,
       price_from, price_from_unit, short_notice, last_confirmed_at, contact_hours,
       is_verified, rating_avg, rating_count, created_at,
       city:city_id(name, slug),
       areas:craftsman_service_areas(city:cities(name, slug, sort)),
       cats:craftsman_categories(category:categories(id, name, slug, sort, parent:parent_id(id, name, slug, sort))),
       services(id, name, description, price_kind, price, unit, sort, category_id),
       photos:work_photos(id, path, caption, sort)`,
    )
    .eq("slug", slug)
    .maybeSingle();
  return data;
});

export async function generateMetadata({ params }: PageProps<"/maistori/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCraftsman(slug);
  if (!c) return { title: "Майсторът не е намерен" };
  const cats = Array.from(new Set(c.cats.map((x) => one(x.category?.parent)?.name ?? x.category?.name).filter(Boolean)));
  const title = `${c.display_name}: ${cats.slice(0, 2).join(", ")}${c.city ? `, ${c.city.name}` : ""}`;
  return {
    title,
    description: `${headlinePrice(c.price_from, c.price_from_unit as PriceUnit | null, c.quote_on_inspection)}. ${c.bio.slice(0, 140)}`,
    alternates: { canonical: `/maistori/${c.slug}` },
    openGraph: { title, type: "profile" },
  };
}

export default async function CraftsmanPage({ params, searchParams }: PageProps<"/maistori/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const c = await getCraftsman(slug);
  if (!c) notFound();

  const supabase = await createClient();
  const viewer = await getViewer();
  const isSelf = viewer?.id === c.id;

  const [{ data: days }, { data: reviews }, { data: canReview }, { data: saved }, { data: conv }, { data: contact }] = await Promise.all([
    supabase.rpc("availability_days", { p_craftsman: c.id, p_from: todayISO(), p_days: 62 }),
    supabase.rpc("craftsman_reviews", { p_craftsman: c.id, p_limit: 30 }),
    viewer && !isSelf ? supabase.rpc("can_review", { p_craftsman: c.id }) : Promise.resolve({ data: false }),
    viewer
      ? supabase.from("saved_craftsmen").select("craftsman_id").eq("client_id", viewer.id).eq("craftsman_id", c.id).maybeSingle()
      : Promise.resolve({ data: null }),
    viewer && !isSelf
      ? supabase.from("conversations").select("id").eq("client_id", viewer.id).eq("craftsman_id", c.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("craftsman_contact_info", { p_craftsman: c.id }).maybeSingle(),
  ]);

  const firstName = c.display_name.split(" ")[0];
  const confirmedDaysAgo = daysSince(c.last_confirmed_at);
  const stale = confirmedDaysAgo > 14;
  const expired = confirmedDaysAgo > 45;

  const topCats = new Map<number, { id: number; name: string; slug: string; sort: number; subs: string[] }>();
  for (const x of c.cats) {
    const cat = x.category;
    if (!cat) continue;
    const parent = one(cat.parent);
    const top = parent ?? cat;
    const entry = topCats.get(top.id) ?? { id: top.id, name: top.name, slug: top.slug, sort: top.sort, subs: [] };
    // "Други услуги" is replaced by the craftsman's own words when given
    if (parent) entry.subs.push(cat.slug === "drugi-uslugi" && c.other_services ? `Други: ${c.other_services}` : cat.name);
    else if (cat.slug === "drugo" && c.other_services) entry.subs.push(`Други: ${c.other_services}`);
    topCats.set(top.id, entry);
  }
  const catList = [...topCats.values()].sort((a, b) => a.sort - b.sort);
  const services = [...c.services].sort((a, b) => a.sort - b.sort);
  // "Каква работа" in the chat: priced services first; a picked category shows only while it has no priced service
  const pricedCats = new Set(services.map((s) => s.category_id).filter(Boolean));
  const workOptions: WorkOption[] = [
    ...services.map((s) => ({
      value: `s:${s.id}`,
      label: `${s.name}: ${servicePrice(s.price_kind as PriceKind, s.price, s.unit as PriceUnit)}`,
      priced: true,
    })),
    ...c.cats
      .map((x) => x.category)
      .filter((x): x is NonNullable<typeof x> => Boolean(x) && !pricedCats.has(x!.id))
      .sort((a, b) => a.sort - b.sort)
      .map((x) => ({
        value: `c:${x.id}`,
        label: (x.slug === "drugi-uslugi" || x.slug === "drugo") && c.other_services ? `Други: ${c.other_services}` : x.name,
        priced: false,
      })),
  ];
  const photos = [...c.photos]
    .sort((a, b) => a.sort - b.sort)
    .map((p) => ({ id: p.id, url: photoUrl(p.path), caption: p.caption, demo: p.path.startsWith("/demo/") }));
  const areas = c.areas
    .map((a) => a.city)
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .sort((a, b) => a.sort - b.sort);
  const myReview = reviews?.find((r) => r.is_mine);
  const dayInfo = (days ?? []).map((d) => ({ day: d.day, status: d.status, ranges: d.ranges })) as DayInfo[];
  const initialDate = typeof sp.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : undefined;
  const price = headlinePrice(c.price_from, c.price_from_unit as PriceUnit | null, c.quote_on_inspection);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: c.business_name ?? c.display_name,
    description: c.bio,
    areaServed: [c.city?.name, ...areas.map((a) => a.name)].filter(Boolean),
    ...(c.rating_count > 0 && {
      aggregateRating: { "@type": "AggregateRating", ratingValue: Number(c.rating_avg), reviewCount: c.rating_count },
    }),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav aria-label="Път" className="mb-5 text-sm text-ink-3">
        <Link href="/maistori" className="link">
          Майстори
        </Link>
        {catList[0] && (
          <>
            {" / "}
            <Link href={`/kategorii/${catList[0].slug}`} className="link">
              {catList[0].name}
            </Link>
          </>
        )}
      </nav>

      {/* Header */}
      <header className="grid gap-6 border-b border-ink pb-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="flex gap-4 sm:gap-6">
          <Avatar name={c.display_name} url={c.avatar_url} size={112} square className="max-sm:!size-20 max-sm:!text-3xl" />
          <div className="min-w-0">
            <h1 className="display flex flex-wrap items-center gap-x-3 text-5xl sm:text-6xl">
              {c.display_name}
              {c.is_verified && (
                <span className="text-3xl">
                  <VerifiedBadge />
                </span>
              )}
            </h1>
            {c.business_name && <p className="mt-1 text-lg font-semibold text-ink-2">{c.business_name}</p>}
            <p className="mt-2 text-lg">{catList.map((x) => x.name).join(" · ")}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
              {c.city && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden /> {c.city.name}
                  {areas.length > 0 && ` и още ${areas.length} ${areas.length === 1 ? "място" : "места"}`}
                </span>
              )}
              <Rating avg={Number(c.rating_avg)} count={c.rating_count} />
              {c.years_experience ? <span>{c.years_experience} години опит</span> : null}
              {c.is_verified && <VerifiedBadge withLabel />}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <p className="numerals text-6xl leading-none sm:text-7xl lg:text-[5.5rem]">{price}</p>
          <div className="hidden gap-2 lg:flex">
            {!isSelf && (
              <SaveButton
                craftsmanId={c.id}
                saved={Boolean(saved)}
                loginHref={`/vhod?next=${encodeURIComponent(`/maistori/${c.slug}`)}`}
              />
            )}
            <OpenChatButton className="btn btn-primary">
              <MessageCircle className="size-4" aria-hidden /> Пиши на {firstName}
            </OpenChatButton>
          </div>
        </div>
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <div className="grid min-w-0 gap-14">
          {expired ? (
            <section aria-labelledby="cal-heading">
              <h2 id="cal-heading" className="display text-4xl">
                Кога е свободен
              </h2>
              <p className="mt-3 rounded-[8px] border border-dashed border-line-strong p-4 text-ink-2">
                {firstName} не е обновявал календара си повече от месец, затова не го показваме. Пишете му и
                попитайте за дата.
              </p>
            </section>
          ) : null}
          <ProfileBooking
            craftsman={{ id: c.id, name: c.display_name, firstName, avatar: c.avatar_url, slug: c.slug }}
            days={expired ? [] : dayInfo}
            stale={stale && !expired}
            workOptions={workOptions}
            initialDate={initialDate}
            me={viewer?.id ?? null}
            banned={viewer?.profile.is_banned ?? false}
            isSelf={isSelf}
            conversationId={conv?.id ?? null}
          />

          {/* Prices */}
          <section id="tseni" aria-labelledby="price-heading">
            <h2 id="price-heading" className="display text-4xl">
              Цени
            </h2>
            <p className="mt-2 flex items-start gap-2 text-ink-2">
              <Info className="mt-1 size-4 shrink-0" aria-hidden />
              Цените са ориентировъчни. Точната цена се уговаря в чата, а за по-големи работи обикновено първо има оглед.
            </p>
            {services.length > 0 ? (
              <table className="mt-4 w-full border-t-[1.5px] border-ink text-left">
                <caption className="sr-only">Ценоразпис на {c.display_name}</caption>
                <thead className="sr-only">
                  <tr>
                    <th scope="col">Услуга</th>
                    <th scope="col">Цена</th>
                  </tr>
                </thead>
                <tbody>
                  {c.hourly_rate && (
                    <tr className="border-b border-line">
                      <th scope="row" className="py-3 pr-4 font-semibold">
                        Час работа
                      </th>
                      <td className="numerals whitespace-nowrap py-3 text-right text-2xl">{formatEur(c.hourly_rate)}/ч</td>
                    </tr>
                  )}
                  {services.map((s) => (
                    <tr key={s.id} className="border-b border-line">
                      <th scope="row" className="py-3 pr-4 font-semibold">
                        {s.name}
                        {s.description && <span className="block text-sm font-normal text-ink-3">{s.description}</span>}
                      </th>
                      <td
                        className={`whitespace-nowrap py-3 text-right ${s.price_kind === "quote" ? "font-semibold text-ink-2" : "numerals text-2xl"}`}
                      >
                        {servicePrice(s.price_kind as PriceKind, s.price, s.unit as PriceUnit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-3 text-ink-2">
                {c.hourly_rate ? `${formatEur(c.hourly_rate)} на час. ` : ""}Питайте {firstName} за цена в чата.
              </p>
            )}
            <h3 className="mt-8 text-lg font-extrabold">Условия</h3>
            <dl className="mt-2 grid border-t border-line text-[0.95rem]">
              <TermRow label="Оглед">
                {inspectionText(c.inspection_policy, c.inspection_fee, c.quote_on_inspection)}
              </TermRow>
              {c.callout_fee != null && <TermRow label="Посещение">{formatEur(c.callout_fee)} минимум за идване</TermRow>}
              {c.travel_fee != null && <TermRow label="Транспорт извън града">{formatEur(c.travel_fee)}</TermRow>}
              <TermRow label="Материали">
                {c.materials_included ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="size-4 text-free" aria-hidden /> Включени в цената
                  </span>
                ) : (
                  "Заплащат се отделно"
                )}
              </TermRow>
            </dl>
            {c.terms_note && (
              <blockquote className="mt-4 border-l-[3px] border-rule pl-4 text-ink-2">
                <p className="whitespace-pre-line">{c.terms_note}</p>
                <footer className="mt-1 text-sm text-ink-3">{firstName} за начина си на работа</footer>
              </blockquote>
            )}
          </section>

          {/* About */}
          <section aria-labelledby="about-heading">
            <h2 id="about-heading" className="display text-4xl">
              За {firstName}
            </h2>
            <p className="mt-3 max-w-[68ch] whitespace-pre-line text-lg leading-relaxed">
              {c.bio || "Майсторът още не е написал описание."}
            </p>
            {catList.some((x) => x.subs.length) && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {catList.flatMap((x) => x.subs).map((s) => (
                  <li key={s} className="rounded-full bg-surface px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ring-line">
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Photos */}
          {photos.length > 0 && (
            <section aria-labelledby="photos-heading">
              <h2 id="photos-heading" className="display mb-4 text-4xl">
                Снимки от работа
              </h2>
              <Gallery photos={photos} name={c.display_name} />
            </section>
          )}

          {/* Reviews */}
          <section id="otzivi" aria-labelledby="reviews-heading">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
              <h2 id="reviews-heading" className="display text-4xl">
                Отзиви
              </h2>
              {c.rating_count > 0 && (
                <p className="flex items-center gap-2 pb-1">
                  <span className="numerals text-3xl">{Number(c.rating_avg).toFixed(1).replace(".", ",")}</span>
                  <Stars value={Number(c.rating_avg)} size="size-5" />
                  <span className="text-ink-3">от {c.rating_count}</span>
                </p>
              )}
            </div>
            {canReview && (
              <div className="mt-5">
                <ReviewForm craftsmanId={c.id} slug={c.slug} existing={myReview ? { rating: myReview.rating, body: myReview.body } : null} />
              </div>
            )}
            {reviews && reviews.length > 0 ? (
              <ul className="mt-5 grid gap-0 border-t border-line">
                {reviews.map((r) => (
                  <li key={r.id} className="border-b border-line py-5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Stars value={r.rating} />
                      <span className="font-bold">{r.author}</span>
                      <span className="text-sm text-ink-3">{timeAgo(r.created_at)}</span>
                      {r.is_mine && (
                        <form action={deleteReview} className="ml-auto">
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="slug" value={c.slug} />
                          <button type="submit" className="text-sm font-semibold text-danger underline">
                            Изтрий моя отзив
                          </button>
                        </form>
                      )}
                    </div>
                    {r.body && <p className="mt-2 max-w-[68ch] text-ink-2">{r.body}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-ink-2">
                {firstName} още няма отзиви. Отзив могат да оставят клиенти, с които е разговарял.
              </p>
            )}
          </section>
        </div>

        {/* Side facts */}
        <aside className="order-first lg:order-none">
          <div className="grid gap-5 rounded-[10px] border border-line bg-surface p-5 lg:sticky lg:top-24">
            <section aria-labelledby="contacts-heading" className="grid gap-3 border-b border-line pb-5">
              <h2 id="contacts-heading" className="text-lg font-extrabold">
                Контакти
              </h2>
              <OpenChatButton className="btn btn-primary w-full">
                <MessageCircle className="size-4" aria-hidden /> {conv ? "Продължи чата" : `Пиши на ${firstName}`}
              </OpenChatButton>
              {!isSelf && (
                <PhoneReveal
                  craftsmanId={c.id}
                  firstName={firstName}
                  hasPhone={Boolean(contact?.has_phone)}
                  visibility={contact?.visibility ?? "hidden"}
                  signedIn={Boolean(viewer)}
                  loginHref={`/vhod?next=${encodeURIComponent(`/maistori/${c.slug}`)}`}
                />
              )}
              {c.contact_hours && (
                <p className="flex gap-2 text-[0.95rem]">
                  <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {c.contact_hours}
                </p>
              )}
            </section>
            <dl className="grid gap-4 text-[0.95rem]">
              <div>
                <dt className="font-bold">Работи в</dt>
                <dd className="mt-1 text-ink-2">{[c.city?.name, ...areas.map((a) => a.name)].filter(Boolean).join(", ")}</dd>
              </div>
              {c.short_notice && (
                <div className="flex gap-2">
                  <Zap className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <div>
                    <dt className="sr-only">Спешни поръчки</dt>
                    <dd>Може да дойде и в същия ден</dd>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <Languages className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <dt className="sr-only">Езици</dt>
                  <dd>{c.languages.map((l) => LANGUAGE_LABEL[l] ?? l).join(", ")}</dd>
                </div>
              </div>
              <div>
                <dt className="font-bold">Календар</dt>
                <dd className="mt-1 text-ink-2">
                  {confirmedDaysAgo < 1 ? "Потвърден днес" : `Потвърден ${timeAgo(c.last_confirmed_at)}`}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      {/* Mobile action bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="numerals truncate text-2xl leading-none">{price}</p>
            <p className="truncate text-sm text-ink-3">{c.display_name}</p>
          </div>
          {!isSelf && (
            <SaveButton craftsmanId={c.id} saved={Boolean(saved)} loginHref={`/vhod?next=${encodeURIComponent(`/maistori/${c.slug}`)}`} />
          )}
          <OpenChatButton className="btn btn-primary">Пиши</OpenChatButton>
        </div>
      </div>
    </div>
  );
}

function TermRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-ink-3">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}

function inspectionText(policy: string | null, fee: number | null, quote: boolean) {
  const eur = fee != null ? formatEur(fee) : "";
  switch (policy) {
    case "free":
      return "Безплатен оглед";
    case "paid":
      return eur ? `Платен оглед: ${eur}` : "Платен оглед (цената се уточнява в чата)";
    case "deducted":
      return eur
        ? `${eur}, приспада се от цената, ако работата се възложи`
        : "Платен, приспада се от цената, ако работата се възложи";
    case "none":
      return "Без оглед: идва направо за работа";
    default:
      return quote ? "За по-големи работи: цена след оглед" : "Уточнява се в чата";
  }
}
