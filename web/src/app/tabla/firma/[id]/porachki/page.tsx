import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import { loadJobs } from "@/lib/jobs-data";
import { JobsManager } from "@/app/tabla/porachki/jobs-manager";

export const metadata: Metadata = { title: "Поръчки на майстор", robots: { index: false } };

export default async function EmployeeJobsPage({ params }: PageProps<"/tabla/firma/[id]/porachki">) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ jobs, clients }, { data: details }, { data: cards }] = await Promise.all([
    loadJobs(supabase, id),
    supabase.rpc("has_feature", { p_craftsman: id, p_feature: "job_details" }),
    supabase.rpc("has_feature", { p_craftsman: id, p_feature: "client_cards" }),
  ]);

  return (
    <div className="grid gap-4">
      <p className="max-w-2xl text-ink-2">
        Поръчка, която запишеш тук, е в календара на майстора и той я вижда в „Поръчки“. Часовете ѝ стават заети и за клиентите.
      </p>
      <JobsManager
        userId={id}
        initialJobs={jobs}
        initialClients={clients}
        today={todayISO()}
        proDetails={Boolean(details)}
        proClients={Boolean(cards)}
        canRequestReview={false}
      />
    </div>
  );
}
