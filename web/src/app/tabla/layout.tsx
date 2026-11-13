import { requireViewer } from "@/lib/auth";
import { DashboardNav } from "@/components/dashboard-nav";
import { getMyOrg } from "@/lib/org";
import { dashboardNav } from "@/lib/dashboard-nav";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: LayoutProps<"/tabla">) {
  const viewer = await requireViewer();
  const org = await getMyOrg();

  const nav = dashboardNav({ craftsmanSlug: viewer.craftsmanSlug, inOrg: Boolean(org) });
  const supabase = await createClient();
  const { data: unreadTotal } = await supabase.rpc("unread_total");
  const unread = { userId: viewer.id, initial: unreadTotal ?? 0 };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      {viewer.profile.is_banned && (
        <p role="alert" className="mb-6 rounded-[8px] bg-danger-soft px-4 py-3 font-semibold text-danger">
          Профилът ви е блокиран от администратор. Не можете да пишете съобщения и профилът ви не се показва.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <DashboardNav groups={nav.groups} publicHref={nav.publicHref} unread={unread} phoneRow />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
