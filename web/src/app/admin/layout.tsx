import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { DashboardNav } from "@/components/dashboard-nav";

export const metadata: Metadata = { title: "Администрация", robots: { index: false } };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="grid gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
        <DashboardNav
          items={[
            { href: "/admin", label: "Потребители" },
            { href: "/admin/kategorii", label: "Категории" },
          ]}
          publicHref={null}
        />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
