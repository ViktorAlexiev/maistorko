import type { Metadata } from "next";
import Link from "next/link";
import { Lock } from "lucide-react";
import { requireCraftsman } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyPlan, hasFeature } from "@/lib/plan";
import { todayISO } from "@/lib/format";
import { OffersManager, type OfferRow } from "./offers-manager";

export const metadata: Metadata = { title: "Оферти", robots: { index: false } };

export default async function OffersPage() {
  const viewer = await requireCraftsman();
  const plan = await getMyPlan();
  const pro = hasFeature(plan, "offers");
  const supabase = await createClient();
  const { data } = pro
    ? await supabase
        .from("offers")
        .select("id, token, title, client_name, total, start_date, end_date, status, valid_until, viewed_at, responded_at, accepted_by, created_at")
        .eq("craftsman_id", viewer.id)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

  return (
    <div className="grid max-w-4xl gap-8">
      <div>
        <h1 className="display text-5xl sm:text-6xl">Оферти</h1>
        <p className="mt-2 max-w-2xl text-lg text-ink-2">
          Избираш работа, сума и материали и получаваш линк. Клиентът го отваря без регистрация и приема с един клик. Това е
          споделена цена и срок, не е фактура.
        </p>
      </div>

      {pro ? (
        <OffersManager initial={(data ?? []) as OfferRow[]} userId={viewer.id} today={todayISO()} />
      ) : (
        <div className="flex items-start gap-3 rounded-[10px] border border-dashed border-line-strong p-5">
          <Lock className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-ink-2">
            Офертите по линк са в Pro.{" "}
            <Link href="/tabla/plan" className="link font-bold">
              Виж плановете
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
