import type { Metadata } from "next";
import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { daysSince, todayISO, timeAgo } from "@/lib/format";
import { ConfirmCalendarBanner } from "@/components/confirm-calendar";
import { ConversationItem, type ConversationSummary } from "@/components/conversation-list";
import { RuleLegend, RuleStrip } from "@/components/rule-strip";
import { EmptyState, Rating, Stars } from "@/components/bits";
import { CraftsmanRow, type CraftsmanCardData } from "@/components/craftsman-row";
import { becomeCraftsman } from "@/app/actions/dashboard";
import { UpcomingBookings } from "@/components/upcoming-bookings";

export const metadata: Metadata = { title: "Моето табло", robots: { index: false } };

export default async function DashboardPage({ searchParams }: PageProps<"/tabla">) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: conversations } = await supabase.rpc("my_conversations");
  const convs = (conversations ?? []) as ConversationSummary[];
  const firstName = (viewer.profile.full_name || "").split(" ")[0];

  const notices = (
    <>
      {sp.parola === "1" && (
        <p role="status" className="mb-6 rounded-[8px] bg-free-soft px-4 py-3 font-semibold text-free">
          Паролата е сменена.
        </p>
      )}
    </>
  );

  if (viewer.craftsmanSlug) {
    const [{ data: cp }, { data: strip }, cats, services, rules, photos] = await Promise.all([
      supabase
        .from("craftsman_profiles")
        .select("id, bio, hourly_rate, last_confirmed_at, rating_avg, rating_count, is_verified, is_hidden")
        .eq("id", viewer.id)
        .single(),
      supabase.rpc("availability_strip", { p_craftsman: viewer.id, p_from: todayISO(), p_days: 14 }),
      supabase.from("craftsman_categories").select("category_id", { count: "exact", head: true }).eq("craftsman_id", viewer.id),
      supabase.from("services").select("id", { count: "exact", head: true }).eq("craftsman_id", viewer.id),
      supabase.from("availability_rules").select("id", { count: "exact", head: true }).eq("craftsman_id", viewer.id),
      supabase.from("work_photos").select("id", { count: "exact", head: true }).eq("craftsman_id", viewer.id),
    ]);
    const daysAgo = cp ? daysSince(cp.last_confirmed_at) : 0;
    const steps = [
      { done: (cats.count ?? 0) > 0, label: "Избери какво работиш", href: "/tabla/profil" },
      { done: Boolean(cp?.bio && cp.bio.length > 40), label: "Напиши няколко изречения за себе си", href: "/tabla/profil" },
      { done: (services.count ?? 0) > 0 || Boolean(cp?.hourly_rate), label: "Добави цени", href: "/tabla/tseni" },
      { done: (rules.count ?? 0) > 0, label: "Отбележи кога си свободен", href: "/tabla/kalendar" },
      { done: (photos.count ?? 0) > 0, label: "Качи снимки от работа", href: "/tabla/snimki" },
    ];
    const done = steps.filter((s) => s.done).length;
    const unread = convs.filter((c) => c.unread_count > 0);

    return (
      <div className="grid gap-8">
        {notices}
        <div>
          <h1 className="display text-5xl sm:text-6xl">Здравей, {firstName}</h1>
          {cp?.is_hidden && (
            <p className="mt-3 rounded-[8px] bg-danger-soft px-4 py-3 font-semibold text-danger">
              Профилът ти е скрит от администратор и не се показва в търсенето.
            </p>
          )}
        </div>

        {done < steps.length && (
          <section aria-labelledby="setup-heading" className="rounded-[10px] border border-line bg-surface p-5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="setup-heading" className="text-xl font-extrabold">
                {sp.nov === "1" ? "Първи стъпки" : "Довърши профила си"}
              </h2>
              <p className="numerals text-2xl">
                {done}/{steps.length}
              </p>
            </div>
            <p className="mt-1 text-ink-2">
              {(cats.count ?? 0) === 0 || (rules.count ?? 0) === 0 || !((services.count ?? 0) > 0 || cp?.hourly_rate)
                ? "Профилът ти се показва в търсенето, след като избереш категории, добавиш цени (или „по оглед“) и отбележиш кога си свободен."
                : "Пълният профил получава повече запитвания."}
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-free transition-[width]" style={{ width: `${(done / steps.length) * 100}%` }} />
            </div>
            <ul className="mt-4 grid gap-1">
              {steps.map((s) => (
                <li key={s.label}>
                  <Link href={s.href} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-2">
                    {s.done ? (
                      <Check className="size-5 text-free" aria-hidden />
                    ) : (
                      <Circle className="size-5 text-line-strong" aria-hidden />
                    )}
                    <span className={s.done ? "text-ink-3 line-through" : "font-semibold"}>{s.label}</span>
                    <span className="sr-only">{s.done ? "(готово)" : "(предстои)"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(rules.count ?? 0) > 0 && daysAgo >= 7 && <ConfirmCalendarBanner daysAgo={daysAgo} />}

        <section aria-labelledby="next-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 id="next-heading" className="display text-4xl">
              Твоите следващи 14 дни
            </h2>
            <Link href="/tabla/kalendar" className="btn btn-outline btn-sm">
              Промени календара
            </Link>
          </div>
          <RuleLegend className="mt-2" />
          {strip ? (
            <div className="mt-3 overflow-x-auto">
              <RuleStrip strip={strip} size="lg" className="min-w-[34rem]" label="Твоите свободни дни" />
            </div>
          ) : null}
          {daysAgo < 7 && (rules.count ?? 0) > 0 && (
            <p className="mt-2 text-sm text-ink-3">Графикът е потвърден {timeAgo(cp!.last_confirmed_at)}.</p>
          )}
        </section>

        <UpcomingBookings title="Предстоящи посещения" />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <section aria-labelledby="msg-heading">
            <div className="flex items-end justify-between">
              <h2 id="msg-heading" className="display text-4xl">
                {unread.length ? `Нови съобщения (${unread.length})` : "Съобщения"}
              </h2>
              <Link href="/saobshtenia" className="link text-sm font-bold">
                Всички
              </Link>
            </div>
            <div className="mt-3 grid gap-1 rounded-[10px] border border-line bg-surface p-1.5">
              {convs.length ? (
                convs.slice(0, 5).map((c) => <ConversationItem key={c.id} c={c} />)
              ) : (
                <p className="p-4 text-ink-2">
                  Още няма запитвания. Клиентите ти пишат от профила ти, обикновено след като видят свободен ден в
                  календара.
                </p>
              )}
            </div>
          </section>
          <section aria-labelledby="rep-heading" className="rounded-[10px] border border-line bg-surface p-5">
            <h2 id="rep-heading" className="text-lg font-extrabold">
              Репутация
            </h2>
            <div className="mt-3">
              <Rating avg={Number(cp?.rating_avg ?? 0)} count={cp?.rating_count ?? 0} />
            </div>
            <p className="mt-3 text-sm text-ink-2">
              {cp?.is_verified
                ? "Профилът ти е проверен от екипа."
                : "Значката „Проверен“ се дава от екипа след проверка на самоличност и опит."}
            </p>
            <Link href={`/maistori/${viewer.craftsmanSlug}#otzivi`} className="link mt-3 inline-block text-sm font-bold">
              Виж отзивите
            </Link>
          </section>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ client
  const [{ data: saved }, { data: myReviews }] = await Promise.all([
    supabase.from("saved_craftsmen").select("craftsman_id").eq("client_id", viewer.id),
    supabase
      .from("reviews")
      .select("id, rating, body, created_at, craftsman:craftsman_profiles(display_name, slug)")
      .eq("client_id", viewer.id)
      .order("created_at", { ascending: false }),
  ]);
  let savedRows: CraftsmanCardData[] = [];
  if (saved?.length) {
    const { data } = await supabase.rpc("search_craftsmen", {
      p_ids: saved.map((s) => s.craftsman_id),
      p_limit: 3,
      p_sort: "soonest",
    });
    savedRows = (data ?? []) as CraftsmanCardData[];
  }

  return (
    <div className="grid gap-10">
      {notices}
      <div>
        <h1 className="display text-5xl sm:text-6xl">Здравей{firstName ? `, ${firstName}` : ""}</h1>
        <p className="mt-2 text-lg text-ink-2">Тук са разговорите ви, запазените майстори и отзивите ви.</p>
      </div>

      <UpcomingBookings title="Уговорени посещения" />

      <section aria-labelledby="c-msg">
        <div className="flex items-end justify-between">
          <h2 id="c-msg" className="display text-4xl">
            Разговори
          </h2>
          <Link href="/saobshtenia" className="link text-sm font-bold">
            Всички
          </Link>
        </div>
        {convs.length ? (
          <div className="mt-3 grid gap-1 rounded-[10px] border border-line bg-surface p-1.5">
            {convs.slice(0, 5).map((c) => (
              <ConversationItem key={c.id} c={c} />
            ))}
          </div>
        ) : (
          <div className="mt-3">
            <EmptyState
              title="Още не сте писали на майстор"
              action={
                <Link href="/maistori" className="btn btn-primary">
                  Намери майстор
                </Link>
              }
            >
              Намерете майстор по вид работа, град и дата, после му пишете от профила му.
            </EmptyState>
          </div>
        )}
      </section>

      <section aria-labelledby="c-saved">
        <div className="flex items-end justify-between">
          <h2 id="c-saved" className="display text-4xl">
            Запазени майстори
          </h2>
          {saved && saved.length > 3 && (
            <Link href="/tabla/zapazeni" className="link text-sm font-bold">
              Всички ({saved.length})
            </Link>
          )}
        </div>
        <div className="mt-3 grid gap-3">
          {savedRows.length ? (
            savedRows.map((c) => <CraftsmanRow key={c.id} c={c} />)
          ) : (
            <p className="text-ink-2">
              Натиснете „Запази“ на профила на майстор, за да го намерите лесно после.
            </p>
          )}
        </div>
      </section>

      {myReviews && myReviews.length > 0 && (
        <section aria-labelledby="c-rev">
          <h2 id="c-rev" className="display text-4xl">
            Вашите отзиви
          </h2>
          <ul className="mt-3 grid border-t border-line">
            {myReviews.map((r) => {
              const cr = Array.isArray(r.craftsman) ? r.craftsman[0] : r.craftsman;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line py-3">
                  <Stars value={r.rating} />
                  {cr && (
                    <Link href={`/maistori/${cr.slug}#otzivi`} className="font-bold hover:underline">
                      {cr.display_name}
                    </Link>
                  )}
                  <span className="text-sm text-ink-3">{timeAgo(r.created_at)}</span>
                  {r.body && <p className="w-full text-ink-2">{r.body}</p>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-[12px] bg-rule p-6 shadow-[inset_0_0_0_1.5px_var(--ink)]">
        <h2 className="display text-4xl">Майстор ли сте и вие?</h2>
        <p className="mt-2 max-w-xl">
          Можете да превърнете профила си в профил на майстор: добавяте какво работите, цени и календар. Разговорите
          ви остават.
        </p>
        <form action={becomeCraftsman} className="mt-4">
          <button type="submit" className="btn btn-primary">
            Стани майстор
          </button>
        </form>
      </section>
    </div>
  );
}
