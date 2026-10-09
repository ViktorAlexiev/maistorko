import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type MyPlan = {
  plan: "free" | "pro" | "company";
  name: string;
  price_month: number;
  /** a missing key means unlimited */
  limits: { services?: number; photos?: number; cities?: number };
  features: string[];
  valid_until: string | null;
  usage: { services: number; photos: number; cities: number };
};

const FALLBACK: MyPlan = {
  plan: "free",
  name: "Безплатен",
  price_month: 0,
  limits: { services: 8, photos: 6, cities: 3 },
  features: [],
  valid_until: null,
  usage: { services: 0, photos: 0, cities: 1 },
};

/** The signed-in craftsman's plan, limits and current usage. Cached per request. */
export const getMyPlan = cache(async (): Promise<MyPlan> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_plan");
  return (data as MyPlan | null) ?? FALLBACK;
});

export const hasFeature = (plan: MyPlan, feature: string) => plan.features.includes(feature);
