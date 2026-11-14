import { DemoProButton } from "@/components/demo-pro-button";
import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { requireCraftsman } from "@/lib/auth";
import { getMyPlan } from "@/lib/plan";
import { formatDate } from "@/lib/format";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = { title: "План", robots: { index: false } };

type Cell = string | boolean;
const ROWS: { label: string; free: Cell; pro: Cell; company: Cell }[] = [
  { label: "Профил, календар, търсене, чат, уговорки, отзиви", free: true, pro: true, company: true },
  { label: "Личен линк и QR код", free: true, pro: true, company: true },
  { label: "Заетост отвън (ден, час, бележка)", free: "без ограничение", pro: "без ограничение", company: "без ограничение" },
  { label: "Услуги в ценоразписа", free: "до 8", pro: "без ограничение", company: "без ограничение" },
  { label: "Снимки от работа", free: "до 6", pro: "без ограничение", company: "без ограничение" },
  { label: "Градове, в които работиш", free: "до 3", pro: "без ограничение", company: "без ограничение" },
  { label: "Клиентска карта, материали и цени към поръчка", free: false, pro: true, company: true },
  { label: "Отчет за месеца", free: false, pro: true, company: true },
  { label: "Подробна статистика по седмици", free: false, pro: true, company: true },
  { label: "Готови отговори в чата (и свои)", free: true, pro: true, company: true },
  { label: "„Заето до …“ с един бутон", free: true, pro: true, company: true },
  { label: "Тетрадка с клиенти: етапи, напомняния, бележки", free: false, pro: true, company: true },
  { label: "Оферта по линк, която клиентът приема с клик", free: false, pro: true, company: true },
  { label: "Ценови подсказки от колегите в града", free: false, pro: true, company: true },
  { label: "Платен бонус в „Препоръчани“ (с етикет „Платен бонус в класирането“)", free: false, pro: true, company: false },
  { label: "Фирмен профил и екип", free: false, pro: false, company: true },
];

function Mark({ v }: { v: Cell }) {
  if (v === true) return <Check className="mx-auto size-5 text-free" aria-label="включено" />;
  if (v === false) return <Minus className="mx-auto size-5 text-ink-3" aria-label="не е включено" />;
  return <span className="text-sm font-semibold">{v}</span>;
}

export default async function PlanPage() {
  const viewer = await requireCraftsman();
  const plan = await getMyPlan();
  const meters = [
    { label: "Услуги", used: plan.usage.services, limit: plan.limits.services },
    { label: "Снимки", used: plan.usage.photos, limit: plan.limits.photos },
    { label: "Градове", used: plan.usage.cities, limit: plan.limits.cities },
  ];

  return (
    <div className="grid max-w-4xl gap-10">
      <div>
        <h1 className="display text-5xl sm:text-6xl">План</h1>
        <p className="mt-2 max-w-2xl text-lg text-ink-2">
          Профилът, календарът и чатът са безплатни завинаги. Pro е за майстори, които искат повече инструменти за работата си.
        </p>
      </div>

      {process.env.DEMO_PRO_BUTTON === "1" && plan.plan !== "company" && <DemoProButton isPro={plan.plan === "pro"} />}

      <section aria-labelledby="current-heading" className="rounded-[10px] border-[1.5px] border-ink bg-surface p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="current-heading" className="text-sm font-bold uppercase tracking-wide text-ink-3">
              Сега ползваш
            </h2>
            <p className="display text-5xl">{plan.name}</p>
            {plan.valid_until && <p className="mt-1 text-ink-2">Важи до {formatDate(plan.valid_until.slice(0, 10))}</p>}
          </div>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-3">
          {meters.map((m) => (
            <div key={m.label}>
              <dt className="text-sm text-ink-3">{m.label}</dt>
              <dd className="numerals mt-0.5 text-3xl leading-none">
                {m.used}
                <span className="ml-1 font-sans text-base font-normal text-ink-3">{m.limit != null ? `от ${m.limit}` : "без лимит"}</span>
              </dd>
              {m.limit != null && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <div className={`h-full rounded-full ${m.used >= m.limit ? "bg-red" : "bg-free"}`} style={{ width: `${Math.min(100, (m.used / m.limit) * 100)}%` }} />
                </div>
              )}
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="compare-heading">
        <h2 id="compare-heading" className="display text-4xl">
          Какво включва всеки план
        </h2>
        <div className="mt-4 overflow-x-auto rounded-[10px] border border-line bg-surface">
          <table className="w-full min-w-[40rem] text-left">
            <caption className="sr-only">Сравнение на плановете</caption>
            <thead className="border-b border-ink text-sm">
              <tr>
                <th scope="col" className="px-4 py-3">
                  &nbsp;
                </th>
                {[
                  ["free", "Безплатен", "0 €"],
                  ["pro", "Pro", "12 € на месец"],
                  ["company", "Фирма", "по договаряне"],
                ].map(([key, name, price]) => (
                  <th key={key} scope="col" className={`px-4 py-3 text-center ${plan.plan === key ? "bg-rule-soft" : ""}`}>
                    <span className="block text-base font-extrabold">{name}</span>
                    <span className="block text-sm font-normal text-ink-2">{price}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-3 font-semibold">
                    {r.label}
                  </th>
                  {(["free", "pro", "company"] as const).map((k) => (
                    <td key={k} className={`px-4 py-3 text-center ${plan.plan === k ? "bg-rule-soft/60" : ""}`}>
                      <Mark v={r[k]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="bonus-terms" className="max-w-3xl">
        <h2 id="bonus-terms" className="text-xl font-extrabold">
          Какво означава платеният бонус
        </h2>
        <p className="mt-2 text-ink-2">
          Планът Pro (12 € на месец) включва платен бонус към оценката за класиране в „Препоръчани“. Бонусът може да подобри позицията
          на профила спрямо профили без Pro, но не гарантира определена позиция, брой показвания или запитвания. Профилите с бонус са
          обозначени „Платен бонус в класирането“, а платените места са най-много 3 от всеки 10 резултата. Бонусът не променя отзивите и
          не скрива профили без Pro. Основните параметри на класирането и тяхната тежест са на страницата{" "}
          <Link href="/kak-podrejdame" className="link font-semibold">
            Как подреждаме
          </Link>
          .
        </p>
      </section>

      {plan.plan === "free" && (
        <section aria-labelledby="pro-heading" className="grid gap-4 rounded-[10px] bg-rule-soft p-5">
          <div>
            <h2 id="pro-heading" className="display text-4xl">
              Искам Pro
            </h2>
            <p className="mt-1 max-w-2xl text-ink-2">
              Плащането още не е включено в сайта. Остави контакт и ще ти включим Pro и ще ти обясним как да платиш.
            </p>
          </div>
          <ContactForm
            kind="pro"
            defaultName={viewer.profile.full_name}
            defaultContact={viewer.email}
            messageLabel="Какво ти трябва най-много"
            button="Поискай Pro"
            success="Благодарим! Ще се свържем с теб за Pro."
          />
        </section>
      )}
    </div>
  );
}
