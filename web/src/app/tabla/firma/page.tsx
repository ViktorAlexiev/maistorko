import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getCities } from "@/lib/data";
import { getMyOrg, isManager } from "@/lib/org";
import { VerifiedBadge } from "@/components/bits";
import { LeaveButton, OrgProfileForm, PendingInvites, TeamList, InviteForm, type TeamMember } from "./team";

export const metadata: Metadata = { title: "Фирма", robots: { index: false } };

export default async function CompanyPage() {
  const viewer = await requireViewer("/tabla/firma");
  const org = await getMyOrg();

  if (!org) {
    return (
      <div className="grid max-w-2xl gap-4">
        <h1 className="display text-5xl sm:text-6xl">Фирма</h1>
        <p className="text-lg text-ink-2">Не сте част от фирма. Ако имате екип от майстори, пишете ни и ще го настроим заедно.</p>
        <p>
          <Link href="/firmi#kontakt" className="btn btn-primary">
            За фирми
          </Link>
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const manager = isManager(org);
  const [{ data: team }, { data: invites }, cities] = await Promise.all([
    supabase.rpc("org_team"),
    manager
      ? supabase
          .from("organization_invites")
          .select("token, role, full_name, email, created_at, expires_at")
          .eq("organization_id", org.id)
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
    manager ? getCities() : Promise.resolve([]),
  ]);

  return (
    <div className="grid max-w-4xl gap-10">
      <div>
        <h1 className="display flex flex-wrap items-center gap-x-3 text-5xl sm:text-6xl">
          {org.name}
          {org.is_verified && (
            <span className="text-3xl">
              <VerifiedBadge />
            </span>
          )}
        </h1>
        <p className="mt-2 text-lg text-ink-2">
          Вие сте {org.role === "owner" ? "собственик" : org.role === "manager" ? "мениджър" : "майстор"} във фирмата.{" "}
          <Link href={`/firmi/${org.slug}`} className="link inline-flex items-center gap-1 font-semibold">
            Публична страница <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </p>
        {org.plan_status === "paused" && (
          <p role="status" className="mt-3 rounded-[8px] bg-danger-soft px-4 py-3 font-semibold text-danger">
            Планът на фирмата е спрян. Майсторите са на безплатен план, докато не бъде включен. Свържете се с нас.
          </p>
        )}
      </div>

      <section aria-labelledby="team-h" className="grid gap-4">
        <h2 id="team-h" className="display text-4xl">
          Екип
        </h2>
        <TeamList team={(team ?? []) as TeamMember[]} meId={viewer.id} myRole={org.role} />
      </section>

      {manager && (
        <>
          <section aria-labelledby="invite-h" className="grid gap-4 rounded-[10px] border border-line bg-surface p-5">
            <div>
              <h2 id="invite-h" className="text-xl font-extrabold">
                Добави човек
              </h2>
              <p className="text-sm text-ink-2">
                Пишеш името, получаваш линк и го пращаш по Viber или имейл. Човекът го отваря, задава парола и профилът му е готов.
              </p>
            </div>
            <InviteForm myRole={org.role} />
            <PendingInvites invites={(invites ?? []) as { token: string; role: string; full_name: string | null; email: string | null; created_at: string; expires_at: string }[]} />
          </section>

          <section aria-labelledby="prof-h" className="grid gap-4 rounded-[10px] border border-line bg-surface p-5">
            <h2 id="prof-h" className="text-xl font-extrabold">
              Профил на фирмата
            </h2>
            <OrgProfileForm
              org={{ id: org.id, name: org.name, description: org.description ?? "", phone: org.phone ?? "", cityId: org.city_id }}
              cities={cities.map((c) => ({ id: c.id, name: c.name }))}
            />
          </section>
        </>
      )}

      {org.role !== "owner" && (
        <section aria-labelledby="leave-h" className="grid gap-2">
          <h2 id="leave-h" className="text-xl font-extrabold">
            Напускане
          </h2>
          <p className="text-ink-2">Профилът, отзивите и снимките ти остават твои. Губиш само достъпа до плана на фирмата.</p>
          <div>
            <LeaveButton />
          </div>
        </section>
      )}
    </div>
  );
}
