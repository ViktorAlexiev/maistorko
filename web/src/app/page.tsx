import Link from "next/link";
import { ArrowRight, CalendarCheck, MessageCircle, Tags } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCategoryCounts, getCategoryTree, getCities } from "@/lib/data";
import { addDaysISO, onWeekday, todayISO } from "@/lib/format";
import { SearchBand } from "@/components/search-band";
import { CraftsmanRow, type CraftsmanCardData } from "@/components/craftsman-row";
import { CategoryIcon } from "@/components/category-icon";
import { RuleLegend } from "@/components/rule-strip";

export default async function HomePage() {
  const supabase = await createClient();
  const [tree, cities, counts, { data: soon }] = await Promise.all([
    getCategoryTree(),
    getCities(),
    getCategoryCounts(),
    supabase.rpc("search_craftsmen", { p_sort: "soonest", p_limit: 4, p_verified: true }),
  ]);

  const target = addDaysISO(todayISO(), 2);
  const weekdayPhrase = onWeekday(target);
  const flatCats = tree.flatMap((p) => [{ slug: p.slug, name: p.name }, ...p.children.map((c) => ({ slug: c.slug, name: c.name }))]);
  const majorCities = cities.filter((c) => c.is_major);

  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* First viewport: the question, the rule-search, live proof            */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 sm:pt-12 lg:pb-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12">
          <div className="flex min-w-0 flex-col">
            <h1 className="display text-[clamp(3.4rem,11vw,6rem)] font-black">
              Кой майстор е свободен <span className="whitespace-nowrap underline decoration-rule decoration-[0.16em] underline-offset-[0.1em] [text-decoration-skip-ink:none]">{weekdayPhrase}</span>?
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-2 sm:text-xl">
              Виж кой може да свърши работата, колко струва и кога е свободен. После просто му пиши и се
              разберете в чата.
            </p>
            <div className="mt-8">
              <SearchBand categories={flatCats} cities={cities} />
            </div>
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-ink-2">
              <span className="font-semibold">Често търсено:</span>
              {[
                ["Електротехник", "/kategorii/elektro"],
                ["ВиК", "/kategorii/vik"],
                ["Климатици", "/kategorii/klimatitsi-otoplenie"],
                ["Майстор за всичко", "/kategorii/maistor-za-vsichko"],
              ].map(([label, href]) => (
                <Link key={href} href={href} className="link font-semibold">
                  {label}
                </Link>
              ))}
            </p>
          </div>

          <aside aria-labelledby="soon-heading" className="min-w-0 lg:pt-3">
            <div className="flex items-end justify-between gap-3">
              <h2 id="soon-heading" className="display text-3xl">
                Свободни скоро
              </h2>
              <Link href="/maistori" className="link text-sm font-bold">
                Всички майстори
              </Link>
            </div>
            <RuleLegend className="mt-2" />
            <div className="stagger stagger-slow mt-4 grid gap-3">
              {(soon as CraftsmanCardData[] | null)?.slice(0, 3).map((c) => (
                <CraftsmanRow key={c.id} c={c} compact />
              ))}
            </div>
          </aside>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Category index: a hardware-store directory, not a tile grid          */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="cats-heading" className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="cats-heading" className="display text-5xl">
              Какво трябва да се свърши?
            </h2>
            <Link href="/kategorii" className="btn btn-outline btn-sm">
              Всички категории <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <ul className="stagger mt-8 grid border-t border-ink sm:grid-cols-2 lg:grid-cols-3">
            {tree.filter((cat) => (counts[cat.slug] ?? 0) > 0).map((cat) => (
              <li key={cat.id} className="border-b border-line sm:odd:border-r lg:border-r lg:[&:nth-child(3n)]:border-r-0">
                <Link
                  href={`/kategorii/${cat.slug}`}
                  className="group flex items-start gap-3.5 px-1 py-4 transition-colors hover:bg-rule-soft/50 sm:px-4"
                >
                  <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-[8px] bg-paper ring-1 ring-inset ring-line transition-colors group-hover:bg-rule group-hover:ring-ink/40">
                    <CategoryIcon name={cat.icon} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[1.05rem] font-extrabold">{cat.name}</span>
                      <span className="numerals shrink-0 text-lg text-ink-3">{counts[cat.slug] ?? 0}</span>
                    </span>
                    <span className="mt-0.5 line-clamp-1 text-sm text-ink-3">
                      {cat.children.map((c) => c.name).join(", ")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How it works: three marks on the rule                                */}
      {/* ------------------------------------------------------------------ */}
      <section id="kak-raboti" aria-labelledby="how-heading" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <h2 id="how-heading" className="display max-w-3xl text-5xl sm:text-6xl">
          Без обяви, без наддаване. Виждаш и пишеш.
        </h2>
        <div className="relative mt-12">
          <div aria-hidden className="graduations absolute inset-x-0 top-0 hidden h-4 rounded-sm bg-rule md:block" />
          <ol className="stagger grid gap-8 md:grid-cols-3 md:gap-10 md:pt-10">
            {[
              {
                icon: Tags,
                title: "Виж кой може и колко струва",
                text: "Всеки майстор сам пише какво работи и какви са цените му: на час, на услуга или на м². Без изненади.",
              },
              {
                icon: CalendarCheck,
                title: "Виж кога е свободен",
                text: "Майсторите отбелязват свободните си дни. Търсиш по дата и виждаш само тези, които могат тогава.",
              },
              {
                icon: MessageCircle,
                title: "Пиши му директно",
                text: "Избираш дата от календара му и пишеш. Уточнявате детайлите в чата, обикновено още същата вечер.",
              },
            ].map((s) => (
              <li key={s.title} className="relative">
                <span aria-hidden className="absolute -top-10 left-0 hidden h-10 w-[3px] bg-red md:block" />
                <s.icon className="size-7" strokeWidth={1.75} aria-hidden />
                <h3 className="mt-3 text-xl font-extrabold">{s.title}</h3>
                <p className="mt-2 text-ink-2">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* For craftsmen: the yellow field                                      */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="pro-heading" className="bg-rule">
        <div className="graduations graduations-top h-3.5" aria-hidden />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <h2 id="pro-heading" className="display text-6xl sm:text-7xl">
              Майстор ли си?
            </h2>
            <p className="mt-4 max-w-xl text-lg">
              Сложи какво работиш, твоите цени и дните, в които си свободен. Клиентите ти пишат директно, без
              посредник и без да плащаш за запитвания.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/registratsia?rolya=maistor" className="btn btn-primary btn-lg">
                Създай профил на майстор
              </Link>
              <Link href="/vhod?next=/tabla/kalendar" className="btn btn-lg border-[1.5px] border-ink bg-transparent hover:bg-ink/10">
                Вече имам профил
              </Link>
            </div>
          </div>
          <ul className="stagger grid gap-0 border-t-[1.5px] border-ink">
            {[
              ["Календарът е с две докосвания", "Седмичен график плюс „Зает съм тази седмица“ с един бутон."],
              ["Твоите цени, твоите правила", "Цена на час, на услуга или „по оглед“. Виждаш и обичайните цени в категорията."],
              ["Разговорите остават в чата", "Телефонът ти не е публичен, освен ако ти не решиш."],
            ].map(([t, d]) => (
              <li key={t} className="border-b-[1.5px] border-ink/80 py-4">
                <p className="text-lg font-extrabold">{t}</p>
                <p className="text-ink/80">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Cities                                                              */}
      {/* ------------------------------------------------------------------ */}
      <section aria-labelledby="cities-heading" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <h2 id="cities-heading" className="display text-4xl">
          Майстори по градове
        </h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {majorCities.map((c) => (
            <Link key={c.slug} href={`/maistori?grad=${c.slug}`} className="chip">
              {c.name}
            </Link>
          ))}
          <Link href="/maistori" className="chip">
            Всички градове
          </Link>
        </div>
      </section>
    </>
  );
}
