import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Client, Job } from "@/lib/jobs";

/** Jobs (with materials) and clients of one craftsman, as the jobs screens expect them. */
export async function loadJobs(supabase: SupabaseClient, craftsmanId: string): Promise<{ jobs: Job[]; clients: Client[] }> {
  const [{ data: jobs }, { data: clients }] = await Promise.all([
    supabase
      .from("jobs")
      .select(
        "id, title, source, start_date, end_date, start_time, end_time, status, note, materials_by_client, labor_price, transport_price, client_id, done_at, job_materials(id, name, qty, amount)",
      )
      .eq("craftsman_id", craftsmanId)
      .order("start_date", { ascending: false })
      .limit(300),
    supabase.from("craftsman_clients").select("id, name, phone, address, note").eq("craftsman_id", craftsmanId).order("name"),
  ]);
  return {
    jobs: (jobs ?? []).map((j) => {
      const { job_materials, ...rest } = j as typeof j & { job_materials: Job["materials"] };
      return {
        ...rest,
        labor_price: rest.labor_price != null ? Number(rest.labor_price) : null,
        transport_price: rest.transport_price != null ? Number(rest.transport_price) : null,
        materials: (job_materials ?? []).map((m) => ({ ...m, amount: Number(m.amount) })),
      } as Job;
    }),
    clients: (clients ?? []) as Client[],
  };
}
