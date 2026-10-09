import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { requireCraftsman } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Статистика", robots: { index: false } };

type Week = { week_start: string; views: number; impressions: number; phone_reveals: number; link_visits: number; inquiries: number; bookings: number };
type Stats = {
  detail: boolean;
  totals: { views: number; impressions: number; phone_reveals: number; link_visits: number; inquiries: number; bookings: number };
  weeks: Week[];
  response: { inquiries: number; replied: number; replied_24h: number; median_minutes: number | null };
};

function duration(min: number) {
  if (min < 1) return "под минута";
  if (min < 60) return `${Math.round(min)} мин`;
  if (min < 60 * 24) return `${Math.round(min / 60)} ч`;
  return `${Math.round(min / 60 / 24)} дни`;
}

export default async function StatsPage() {
  await requireCraftsman();
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_stats", { p_weeks: 8 });
  const stats = data as Stats | null;
  if (!stats) return <p className="text-ink-2">Статистиката не се зареди. Опитай пак.</p>;
  const { totals: t, response: r, weeks } = stats;

  const tiles: [string, number, string][] = [
    ["Показвания в търсенето", t.impressions, "колко пъти си излизал в списък"],
    ["Прегледи на профила", t.views, "хора, отворили профила ти"],
    ["Покажи телефона", t.phone_reveals, "хора, поискали номера ти"],
    ["Запитвания", t.inquiries, "нови разговори с клиенти"],
    ["Уговорки", t.bookings, "потвърдени оглед или работа"],
    ["През личния линк", t.link_visits, "отворили линка или QR кода"],
  ];
  const maxViews = Math.max(1, ...weeks.map((w) => w.views));
  const conversion = t.views > 0 ? Math.round((t.inquiries / t.views) * 100) : null;

  return (
    <div className="grid max-w-4xl gap-10">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Статистика</h1>
        <p className="mt-2 max-w-2xl text-lg text-ink-2">
          Какво се случва с профила ти. Не пазим данни за посетителите, само броячи.
        </p>
      </div>

      <section aria-labelledby="last30" className="grid gap-4">
        <h2 id="last30" className="display text-4xl">
          Последните 30 дни
        </h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          {tiles.map(([label, value, hint]) => (
            <div key={label} className="rounded-[10px] border border-line bg-surface p-4">
              <dt className="text-sm font-bold text-ink-2">{label}</dt>
              <dd className="numerals mt-1 text-5xl leading-none">{value}</dd>
              <p className="mt-1 text-xs text-ink-3">{hint}</p>
            </div>
          ))}
        </dl>
        {conversion !== null && (
          <p className="text-ink-2">
            От всеки 100 души, отворили профила ти, <strong className="text-ink">{conversion}</strong> са ти писали.
          </p>
        )}
      </section>

      <section aria-labelledby="speed" className="grid gap-3 rounded-[10px] bg-rule-soft p-5">
        <h2 id="speed" className="display text-4xl">
          Колко бързо отговаряш
        </h2>
        {r.inquiries === 0 ? (
          <p className="text-ink-2">Още няма запитвания за последните 3 месеца.</p>
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-sm font-bold text-ink-2">Отговорени</dt>
                <dd className="numerals text-4xl leading-none">
                  {Math.round((r.replied / r.inquiries) * 100)}%
                </dd>
              </div>
              <div>
                <dt className="text-sm font-bold text-ink-2">До 24 часа</dt>
                <dd className="numerals text-4xl leading-none">{Math.round((r.replied_24h / r.inquiries) * 100)}%</dd>
              </div>
              <div>
                <dt className="text-sm font-bold text-ink-2">Обикновено отговаряш за</dt>
                <dd className="numerals text-4xl leading-none">{r.median_minutes != null ? duration(r.median_minutes) : "-"}</dd>
              </div>
            </dl>
            <p className="text-sm text-ink-2">
              Смята се за последните 3 месеца ({r.inquiries} {r.inquiries === 1 ? "запитване" : "запитвания"}). Бързият отговор е най-
              силният начин да получаваш повече работа: повечето клиенти пишат на няколко майстори и избират първия, който отговори.
            </p>
          </>
        )}
      </section>

      <section aria-labelledby="weekly" className="grid gap-3">
        <h2 id="weekly" className="display text-4xl">
          По седмици
        </h2>
        {!stats.detail ? (
          <div className="flex items-start gap-3 rounded-[10px] border border-dashed border-line-strong p-5">
            <Lock className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="text-ink-2">
              Подробната статистика по седмици (показвания, прегледи, обаждания, запитвания, уговорки) е в Pro.{" "}
              <Link href="/tabla/plan" className="link font-bold">
                Виж плановете
              </Link>
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-[10px] border border-line bg-surface">
            <table className="w-full min-w-[40rem] text-left">
              <caption className="sr-only">Статистика по седмици</caption>
              <thead className="border-b border-ink text-sm">
                <tr>
                  <th scope="col" className="px-4 py-3">Седмица от</th>
                  <th scope="col" className="px-4 py-3">Прегледи</th>
                  <th scope="col" className="px-4 py-3 text-right">Показвания</th>
                  <th scope="col" className="px-4 py-3 text-right">Телефон</th>
                  <th scope="col" className="px-4 py-3 text-right">Запитвания</th>
                  <th scope="col" className="px-4 py-3 text-right">Уговорки</th>
                </tr>
              </thead>
              <tbody>
                {[...weeks].reverse().map((w) => (
                  <tr key={w.week_start} className="border-b border-line last:border-0">
                    <th scope="row" className="px-4 py-2.5 font-semibold">
                      {formatDate(w.week_start)}
                    </th>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-32 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                          <span className="block h-full rounded-full bg-ink" style={{ width: `${(w.views / maxViews) * 100}%` }} />
                        </span>
                        <span className="numerals text-lg">{w.views}</span>
                      </div>
                    </td>
                    <td className="numerals px-4 py-2.5 text-right text-lg">{w.impressions}</td>
                    <td className="numerals px-4 py-2.5 text-right text-lg">{w.phone_reveals}</td>
                    <td className="numerals px-4 py-2.5 text-right text-lg">{w.inquiries}</td>
                    <td className="numerals px-4 py-2.5 text-right text-lg">{w.bookings}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
