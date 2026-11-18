import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Clock, Languages, MapPin, MessageCircle } from "lucide-react";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { isBot } from "@/lib/bots";
import { photoUrl } from "@/lib/data";
import {
  daysSince,
  formatDate,
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
import { ReportButton } from "@/components/report-button";
import { OrgChatButton } from "@/components/org-chat-button";
import { SaveButton } from "@/components/save-button";
import { Gallery } from "@/components/gallery";
import { ReviewForm } from "@/components/review-form";
import { BUSY_UNTIL_NOTE } from "@/components/busy-until-note";
import { hourEstimate, type BoxKind } from "@/lib/prices";
import { ProfilePrices, type ProfileBox, type ProfileGroup } from "./profile-prices";

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
       callout_fee, travel_fee, materials_included, quote_on_inspection,
       inspection_policy, inspection_fee, terms_note, other_services,
       price_from, price_from_unit, short_notice, last_confirmed_at, contact_hours, reply_within_hours,
       is_verified, rating_avg, rating_count, created_at,
       city:city_id(name, slug),
       areas:craftsman_service_areas(city:cities(name, slug, sort)),
       cats:craftsman_categories(category:categories(id, name, slug, sort, parent:parent_id(id, name, slug, sort))),
       services(id, name, description, price_kind, price, unit, sort, category_id, template_id, template:job_templates(typical_hours)),
       prices:category_prices(category_id, kind, price, unit),
       photos:work_photos(id, path, caption, sort)`,
    )
    .eq("slug", slug)
    .maybeSingle();
  return data;
});

/** The headline price: the same rule as the catalog row, „по оглед“ also when a ticked subcategory's box says so. */
function headline(c: NonNullable<Awaited<ReturnType<typeof getCraftsman>>>) {
  const ticked = new Set(c.cats.map((x) => x.category?.id));
  const quote =
    c.quote_on_inspection ||
    c.prices.some((p) => p.kind === "quote" && ticked.has(p.category_id)) ||
    c.services.some((s) => s.price_kind === "quote" && s.category_id != null && ticked.has(s.category_id));
  return headlinePrice(c.price_from, c.price_from_unit as PriceUnit | null, quote);
}

export async function generateMetadata({ params }: PageProps<"/maistori/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCraftsman(slug);
  if (!c) return { title: "Майсторът не е намерен" };
  const cats = Array.from(new Set(c.cats.map((x) => one(x.category?.parent)?.name ?? x.category?.name).filter(Boolean)));
  const title = `${c.display_name}: ${cats.slice(0, 2).join(", ")}${c.city ? `, ${c.city.name}` : ""}`;
  return {
    title,
    description: `${headline(c)}. ${c.bio.slice(0, 140)}`,
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
  if (!isSelf && !(await isBot())) {
    after(async () => {
      await supabase.rpc("record_profile_view", { p_slug: slug });
    });
  }

  const [{ data: days }, { data: reviews }, { data: myReview }, { data: canReview }, { data: saved }, { data: conv }, { data: contact }, { data: worksAt }, { data: busyRows }] = await Promise.all([
    supabase.rpc("availability_days", { p_craftsman: c.id, p_from: todayISO(), p_days: 62 }),
    supabase.rpc("craftsman_reviews", { p_craftsman: c.id, p_limit: 30 }),
    // the viewer's own review, read directly: it may be older than the 30 newest shown in the list
    viewer
      ? supabase.from("reviews").select("id, rating, body").eq("client_id", viewer.id).eq("craftsman_id", c.id).maybeSingle()
      : Promise.resolve({ data: null }),
    viewer && !isSelf ? supabase.rpc("can_review", { p_craftsman: c.id }) : Promise.resolve({ data: false }),
    viewer
      ? supabase.from("saved_craftsmen").select("craftsman_id").eq("client_id", viewer.id).eq("craftsman_id", c.id).maybeSingle()
      : Promise.resolve({ data: null }),
    viewer && !isSelf
      ? supabase.from("conversations").select("id").eq("client_id", viewer.id).eq("craftsman_id", c.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("craftsman_contact_info", { p_craftsman: c.id }).maybeSingle(),
    supabase.from("organization_members").select("org:organizations(id, name, slug, is_verified, is_hidden)").eq("user_id", c.id).maybeSingle(),
    supabase
      .from("availability_exceptions")
      .select("end_date")
      .eq("craftsman_id", c.id)
      .eq("note", BUSY_UNTIL_NOTE)
      .lte("start_date", todayISO())
      .gte("end_date", todayISO())
      .order("end_date", { ascending: false })
      .limit(1),
  ]);
  const busyUntil = busyRows?.[0]?.end_date ?? null;
  const orgRaw = worksAt?.org;
  const company = (Array.isArray(orgRaw) ? orgRaw[0] : orgRaw) as { id: string; name: string; slug: string; is_verified: boolean; is_hidden: boolean } | null | undefined;

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
  // "Каква работа" in the chat: priced services first; a picked category shows only while it has no priced service.
  // Only services in a ticked subcategory count (the boxes below show the same ones; „Други услуги“ is hidden from clients).
  const boxIds = new Set(c.cats.flatMap((x) => (x.category && one(x.category.parent) ? [x.category.id] : [])));
  const shownServices = services.filter((s) => s.category_id != null && boxIds.has(s.category_id));
  const pricedCats = new Set(shownServices.map((s) => s.category_id));
  const workOptions: WorkOption[] = [
    ...shownServices.map((s) => ({
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
  // Usual price ranges (indicative) for the jobs that come from the ready-made list
  const templateIds = [...new Set(services.map((s) => s.template_id).filter((x): x is number => x != null))];
  const { data: rangeRows } = templateIds.length
    ? await supabase.rpc("template_price_ranges", { p_templates: templateIds, p_city: c.city?.slug ?? undefined })
    : { data: [] };
  const rangeOf = new Map((rangeRows ?? []).map((r) => [r.template_id, r]));
  // One box per ticked subcategory (a ticked top-level category has no box); it shows when it has a price or a service
  const priceOf = new Map(c.prices.map((p) => [p.category_id, p]));
  const groupMap = new Map<number, { id: number; name: string; sort: number; boxes: { sort: number; box: ProfileBox }[] }>();
  for (const x of c.cats) {
    const cat = x.category;
    const parent = cat ? one(cat.parent) : null;
    if (!cat || !parent) continue;
    const row = priceOf.get(cat.id);
    const box: ProfileBox = {
      id: cat.id,
      name: cat.name,
      kind: (row?.kind ?? null) as BoxKind | null,
      price: row?.price ?? null,
      unit: (row?.unit ?? "job") as PriceUnit,
      services: [],
    };
    box.services = services
      .filter((s) => s.category_id === cat.id)
      .map((s) => {
        const range = s.template_id != null ? rangeOf.get(s.template_id) : undefined;
        return {
          id: s.id,
          name: s.name,
          description: s.description,
          kind: s.price_kind as PriceKind,
          price: s.price,
          unit: s.unit as PriceUnit,
          estimate: s.price_kind === "quote" && s.template_id != null ? hourEstimate(box, one(s.template)?.typical_hours) : null,
          range: range ? { p25: Number(range.p25), p75: Number(range.p75), scope: range.scope } : null,
        };
      });
    const hasPrice = box.kind === "quote" || (box.kind !== null && box.price !== null);
    if (!hasPrice && box.services.length === 0) continue;
    const group = groupMap.get(parent.id) ?? { id: parent.id, name: parent.name, sort: parent.sort, boxes: [] };
    group.boxes.push({ sort: cat.sort, box });
    groupMap.set(parent.id, group);
  }
  const priceGroups: ProfileGroup[] = [...groupMap.values()]
    .sort((a, b) => a.sort - b.sort || a.id - b.id)
    .map((g) => ({
      id: g.id,
      name: g.name,
      boxes: g.boxes.sort((a, b) => a.sort - b.sort || a.box.id - b.box.id).map((x) => x.box),
    }));
  const dayInfo = (days ?? []).map((d) => ({ day: d.day, status: d.status, ranges: d.ranges })) as DayInfo[];
  const initialDate = typeof sp.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.data) ? sp.data : undefined;
  const price = headline(c);

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
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
            {company && !company.is_hidden && (
              <p className="mt-1 text-ink-2">
                Работи във фирма{" "}
                <Link href={`/firmi/${company.slug}`} className="link font-bold">
                  {company.name}
                </Link>
                {company.is_verified && <span className="ml-1.5 align-middle"><VerifiedBadge /></span>}
              </p>
            )}
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
        <div className="grid min-w-0 gap-14 max-lg:contents max-lg:[&>#kalendar~*]:order-2">
          {busyUntil && (
            <p role="status" className="rounded-[8px] bg-rule px-4 py-3 font-bold shadow-[inset_0_0_0_1.5px_var(--ink)]">
              {firstName} е зает до {formatDate(busyUntil)}. Можете да му пишете за след този период.
            </p>
          )}
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
            craftsman={{ id: c.id, name: c.display_name, firstName, avatar: c.avatar_url, slug: c.slug, city: c.city?.name ?? null, categories: catList.map((x) => ({ slug: x.slug, name: x.name })) }}
            days={expired ? [] : dayInfo}
            stale={stale && !expired}
            confirmedLabel={confirmedDaysAgo < 1 ? "График, потвърден днес" : `График, потвърден ${timeAgo(c.last_confirmed_at)}`}
            workOptions={workOptions}
            initialDate={initialDate}
            me={viewer?.id ?? null}
            banned={viewer?.profile.is_banned ?? false}
            isSelf={isSelf}
            conversationId={conv?.id ?? null}
          />

          {/* Prices */}
          <ProfilePrices
            groups={priceGroups}
            showGroupNames={catList.length >= 2}
            firstName={firstName}
            cityName={c.city?.name ?? null}
            terms={{
              callout: c.callout_fee,
              travel: c.travel_fee,
              materials: c.materials_included,
              quoteOnInspection: c.quote_on_inspection,
              policy: c.inspection_policy,
              inspectionFee: c.inspection_fee,
              note: c.terms_note,
            }}
          />

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
            {(canReview || myReview) && (
              <div className="mt-5">
                <ReviewForm
                  key={myReview?.id ?? "new"}
                  craftsmanId={c.id}
                  slug={c.slug}
                  existing={myReview ? { rating: myReview.rating, body: myReview.body } : null}
                  deleteId={myReview?.id}
                  canReviewAgain={Boolean(canReview)}
                />
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
                      {r.edited_at && (
                        <span className="text-sm text-ink-3" title={`редактиран ${timeAgo(r.edited_at)}`}>
                          · редактиран
                        </span>
                      )}
                    </div>
                    {r.body && <p className="mt-2 max-w-[68ch] text-ink-2">{r.body}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-ink-2">
                {firstName} още няма отзиви. Отзив могат да оставят клиенти, при които е работил или е идвал на оглед.
              </p>
            )}
          </section>
        </div>

        {/* Side facts */}
        <aside className="max-lg:order-1">
          <div className="grid gap-5 rounded-[10px] border border-line bg-surface p-5 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-contain">
            <section aria-labelledby="contacts-heading" className="grid gap-3 border-b border-line pb-5">
              <h2 id="contacts-heading" className="text-lg font-extrabold">
                Контакти
              </h2>
              <OpenChatButton className="btn btn-primary w-full">
                <MessageCircle className="size-4" aria-hidden /> {conv ? "Продължи чата" : `Пиши на ${firstName}`}
              </OpenChatButton>
              {company && !company.is_hidden && !isSelf && (
                <OrgChatButton
                  orgId={company.id}
                  orgName={company.name}
                  signedIn={Boolean(viewer)}
                  loginHref={`/vhod?next=${encodeURIComponent(`/maistori/${c.slug}`)}`}
                  className="btn btn-outline w-full"
                  label={`Пиши на ${company.name}`}
                />
              )}
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
              {c.reply_within_hours != null && (
                <p className="flex gap-2 text-[0.95rem] font-semibold">
                  <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  Обикновено отговаря {c.reply_within_hours >= 48 ? "до 2 дни" : c.reply_within_hours === 24 ? "до 24 часа" : c.reply_within_hours === 1 ? "до 1 час" : `до ${c.reply_within_hours} часа`}
                </p>
              )}
              {c.contact_hours && (
                <p className="flex gap-2 text-[0.95rem]">
                  <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {c.contact_hours}
                </p>
              )}
              {!isSelf && (
                <div>
                  <ReportButton
                    type="profile"
                    targetId={c.id}
                    signedIn={Boolean(viewer)}
                    loginHref={`/vhod?next=${encodeURIComponent(`/maistori/${c.slug}`)}`}
                    label="Докладвай профила"
                  />
                </div>
              )}
            </section>
            <dl className="grid gap-4 text-[0.95rem]">
              <div>
                <dt className="font-bold">Работи в</dt>
                <dd className="mt-1 text-ink-2">{[c.city?.name, ...areas.map((a) => a.name)].filter(Boolean).join(", ")}</dd>
              </div>
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

/** JSON for a ld+json script. `<` is escaped so profile text like "</script>" can't break out of the tag. */
function safeJsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
