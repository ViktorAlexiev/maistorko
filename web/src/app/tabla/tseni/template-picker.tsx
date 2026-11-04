"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { toMoney } from "@/lib/validation";

export type Template = { id: number; name: string; unit: "job" | "hour" | "m2" | "piece" | "meter" | "day"; category_slug: string };
export type Range = { p25: number; p75: number; scope: "city" | "all" };

const UNIT_LABEL: Record<string, string> = { job: "за работа", hour: "на час", m2: "на м²", piece: "на брой", meter: "на метър", day: "на ден" };

/**
 * Ready-made typical jobs of the categories the craftsman works in. He does not start from an empty page: he writes a
 * price next to the jobs he does and adds them (an empty price means "по оглед"). Pro also sees what colleagues charge.
 */
export function TemplatePicker({
  userId,
  templates,
  categoryNames,
  taken,
  ranges,
  isPro,
}: {
  userId: string;
  templates: Template[];
  categoryNames: Record<string, string>;
  taken: number[];
  /** only for Pro: the usual price of each job */
  ranges: Record<number, Range>;
  isPro: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [prices, setPrices] = useState<Record<number, string>>({});
  const [added, setAdded] = useState<number[]>([]);
  const gone = new Set([...taken, ...added]);
  const open = templates.filter((t) => !gone.has(t.id));
  const groups = [...new Set(open.map((t) => t.category_slug))];

  function add(t: Template) {
    const raw = (prices[t.id] ?? "").trim();
    const price = raw ? toMoney(raw) : null;
    if (raw && price === null) return void toast.error("Напиши цената с числа, например 35.");
    start(async () => {
      const { error } = await supabase.from("services").insert({
        craftsman_id: userId,
        name: t.name,
        price_kind: price === null ? "quote" : "fixed",
        price: price === null ? null : price,
        unit: t.unit,
        template_id: t.id,
        sort: 100,
      });
      if (error) return void toast.error(error.message);
      setAdded((a) => [...a, t.id]);
      toast.success(price === null ? `„${t.name}“ е добавена „по оглед“.` : `„${t.name}“ е добавена.`);
      router.refresh();
    });
  }

  if (templates.length === 0) return null;
  return (
    <section aria-labelledby="tpl-heading" className="grid gap-4 rounded-[10px] border border-line bg-surface p-5">
      <div>
        <h2 id="tpl-heading" className="text-xl font-extrabold">
          Типични работи във вашите категории
        </h2>
        <p className="mt-1 max-w-2xl text-ink-2">
          Напиши цена до работите, които вършиш, и натисни „Добави“. Ако оставиш цената празна, работата се добавя „по оглед“ и клиентите виждат
          ориентировъчна цена от часовата ти ставка.
        </p>
        {!isPro && (
          <p className="mt-2 flex items-start gap-2 text-sm text-ink-2">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              Колко вземат колегите за всяка работа се вижда в Pro.{" "}
              <Link href="/tabla/plan" className="link font-bold">
                Виж плановете
              </Link>
            </span>
          </p>
        )}
      </div>

      {open.length === 0 ? (
        <p className="text-ink-2">Добавил си всички типични работи за категориите си.</p>
      ) : (
        groups.map((slug) => (
          <div key={slug}>
            <h3 className="font-extrabold">{categoryNames[slug] ?? slug}</h3>
            <ul className="mt-2 grid border-t border-line">
              {open
                .filter((t) => t.category_slug === slug)
                .map((t) => {
                  const r = ranges[t.id];
                  return (
                    <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{t.name}</p>
                        <p className="text-sm text-ink-3">
                          {UNIT_LABEL[t.unit]}
                          {isPro && r && (
                            <>
                              {" · "}
                              <span className="font-semibold text-ink-2">
                                колегите {r.scope === "city" ? "в твоя град" : "в страната"} вземат {r.p25}–{r.p75} €
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          className="field w-24"
                          inputMode="decimal"
                          placeholder="€"
                          aria-label={`Цена за „${t.name}“`}
                          value={prices[t.id] ?? ""}
                          onChange={(e) => setPrices((p) => ({ ...p, [t.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              add(t);
                            }
                          }}
                        />
                        <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => add(t)}>
                          <Plus className="size-4" aria-hidden /> Добави
                        </button>
                      </div>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
