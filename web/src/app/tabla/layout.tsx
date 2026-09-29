import { requireViewer } from "@/lib/auth";
import { DashboardNav } from "@/components/dashboard-nav";

export default async function DashboardLayout({ children }: LayoutProps<"/tabla">) {
  const viewer = await requireViewer();
  const craftsman = Boolean(viewer.craftsmanSlug);

  const items = craftsman
    ? [
        { href: "/tabla", label: "Преглед" },
        { href: "/tabla/kalendar", label: "Календар" },
        { href: "/tabla/tseni", label: "Цени и услуги" },
        { href: "/tabla/snimki", label: "Снимки" },
        { href: "/tabla/profil", label: "Профил" },
        { href: "/saobshtenia", label: "Съобщения" },
      ]
    : [
        { href: "/tabla", label: "Преглед" },
        { href: "/tabla/zapazeni", label: "Запазени майстори" },
        { href: "/saobshtenia", label: "Съобщения" },
        { href: "/tabla/profil", label: "Профил" },
      ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      {viewer.profile.is_banned && (
        <p role="alert" className="mb-6 rounded-[8px] bg-danger-soft px-4 py-3 font-semibold text-danger">
          Профилът ви е блокиран от администратор. Не можете да пишете съобщения и профилът ви не се показва.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <DashboardNav items={items} publicHref={viewer.craftsmanSlug ? `/maistori/${viewer.craftsmanSlug}` : null} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
