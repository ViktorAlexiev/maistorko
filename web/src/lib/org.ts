import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type OrgRole = "owner" | "manager" | "craftsman";

export type MyOrg = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  phone: string | null;
  city_id: number | null;
  is_verified: boolean;
  plan_status: "active" | "paused";
  role: OrgRole;
};

/** The company the signed-in user belongs to (with their role there), or null. Cached per request. */
export const getMyOrg = cache(async (): Promise<MyOrg | null> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const id = claims?.claims?.sub;
  if (!id) return null;
  const { data: m } = await supabase.from("organization_members").select("organization_id, role").eq("user_id", id).maybeSingle();
  if (!m) return null;
  const { data: o } = await supabase
    .from("organizations")
    .select("id, slug, name, description, phone, city_id, is_verified, plan_status")
    .eq("id", m.organization_id)
    .maybeSingle();
  return o ? ({ ...o, role: m.role } as MyOrg) : null;
});

export const isManager = (o: MyOrg | null) => o?.role === "owner" || o?.role === "manager";

export const ROLE_LABEL: Record<OrgRole, string> = { owner: "Собственик", manager: "Мениджър", craftsman: "Майстор" };
