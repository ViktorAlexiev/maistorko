import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { requireCraftsman } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyPlan, hasFeature } from "@/lib/plan";
import { formatEur, MONTHS, todayISO } from "@/lib/format";
import { monthRange, shiftMonth, SOURCE_LABEL, type Client, type Job, type JobSource } from "@/lib/jobs";
import { JobsManager } from "./jobs-manager";

export const metadata: Metadata = { title: "Поръчки", robots: { index: false } };

type Report = {
  jobs: number;
  done: number;
  cancelled: number;
  labor: number;
  transport: number;
  materials: number;
  by_source: { source: JobSource; count: number }[];
  top_work: { title: string; count: number }[];
};

export default async function JobsPage({ searchParams }: PageProps<"/tabla/porachki">) {
  const viewer = await requireCraftsman();
  const sp = await searchParams;
  const supabase = await createClient();
  const plan = await getMyPlan();
  const today = todayISO();
  const ym = typeof sp.mesec === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.mesec) ? sp.mesec : today.slice(0, 7);
  const proDetails = hasFeature(plan, "job_details");
  const proClients = hasFeature(plan, "client_cards");
  const proReports = hasFeature(plan, "reports");

  const [{ data: jobs }, { data: clients }, report] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, title, source, start_date, end_date, start_time, end_time, status, note, materials_by_client, labor_price, transport_price, client_id, done_at, job_materials(id, name, qty, amount)",
      )
      .eq("craftsman_id", viewer.id)
      .order("start_date", { ascending: false })
      .limit(300),
    supabase.from("craftsman_clients").select("id, name, phone, address, note").eq("craftsman_id", viewer.id).order("name"),
    proReports
      ? supabase.rpc("job_report", { p_from: monthRange(ym).from, p_to: monthRange(ym).to }).then((r) => r.data as Report | null)
      : Promise.resolve(null),
  ]);

  const list: Job[] = (jobs ?? []).map((j) => {
    const { job_materials, ...rest } = j as typeof j & { job_materials: Job["materials"] };
    return {
      ...rest,
      labor_price: rest.labor_price != null ? Number(rest.labor_price) : null,
      transport_price: rest.transport_price != null ? Number(rest.transport_price) : null,
      materials: (job_materials ?? []).map((m) => ({ ...m, amount: Number(m.amount) })),
    } as Job;
  });

  const revenue = report ? report.labor + report.transport + report.materials : 0;
  const [y, m] = ym.split("-").map(Number);

  return (
    <div className="grid max-w-4xl gap-10">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Поръчки</h1>
        <p className="mt-2 max-w-2xl text-lg text-ink-2">
          Работа, която не е дошла през чата: обаждане, препоръка, познат. Щом я запишеш, часовете ѝ стават заети в
          календара и клиентите от сайта не ги виждат като свободни.
        </p>
      </div>

      <JobsManager
        userId={viewer.id}
        initialJobs={list}
        initialClients={(clients ?? []) as Client[]}
        today={today}
        proDetails={proDetails}
        proClients={proClients}
      />

      <section aria-labelledby="report-heading" className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="report-heading" className="display text-4xl">
            Отчет за месеца
          </h2>
          {proReports && (
            <div className="flex items-center gap-1">
              <Link href={`/tabla/porachki?mesec=${shiftMonth(ym, -1)}`} className="btn btn-ghost btn-sm" aria-label="Предишен месец">
                <ChevronLeft className="size-5" aria-hidden />
              </Link>
              <span className="min-w-36 text-center text-lg font-extrabold capitalize">
                {MONTHS[m - 1]} {y}
              </span>
              <Link href={`/tabla/porachki?mesec=${shiftMonth(ym, 1)}`} className="btn btn-ghost btn-sm" aria-label="Следващ месец">
                <ChevronRight className="size-5" aria-hidden />
              </Link>
            </div>
          )}
        </div>

        {!proReports || !report ? (
          <div className="flex items-start gap-3 rounded-[10px] border border-dashed border-line-strong p-5">
            <Lock className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="text-ink-2">
              Отчетът (колко поръчки, колко пари, откъде идват клиентите) е в Pro.{" "}
              <Link href="/tabla/plan" className="link font-bold">
                Виж плановете
              </Link>
            </p>
          </div>
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-4">
              {[
                ["Поръчки", report.jobs],
                ["Свършени", report.done],
                ["Приходи", formatEur(revenue)],
                ["От тях труд", formatEur(report.labor)],
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-[10px] border border-line bg-surface p-4">
                  <dt className="text-sm text-ink-3">{label}</dt>
                  <dd className="numerals mt-1 text-3xl leading-none">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-ink-3">
              Приходите се броят само за свършените поръчки: труд {formatEur(report.labor)}, транспорт {formatEur(report.transport)}, материали, които си
              осигурил ти, {formatEur(report.materials)}.
            </p>
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <h3 className="font-extrabold">Откъде идва работата</h3>
                {report.by_source.length === 0 ? (
                  <p className="mt-1 text-ink-3">Още няма поръчки този месец.</p>
                ) : (
                  <ul className="mt-2 grid gap-1.5">
                    {report.by_source.map((s) => (
                      <li key={s.source} className="flex items-center gap-3">
                        <span className="w-32 shrink-0">{SOURCE_LABEL[s.source]}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                          <span className="block h-full rounded-full bg-ink" style={{ width: `${(s.count / report.jobs) * 100}%` }} />
                        </span>
                        <span className="numerals w-6 text-right text-lg">{s.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="font-extrabold">Най-чести работи</h3>
                {report.top_work.length === 0 ? (
                  <p className="mt-1 text-ink-3">Още няма поръчки този месец.</p>
                ) : (
                  <ol className="mt-2 grid gap-1.5">
                    {report.top_work.map((t) => (
                      <li key={t.title} className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate first-letter:uppercase">{t.title}</span>
                        <span className="numerals text-lg">{t.count}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
