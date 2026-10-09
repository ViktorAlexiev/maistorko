import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyOrg, isManager } from "@/lib/org";
import { Avatar } from "@/components/avatar";
import { EmployeeTabs } from "./tabs";

/** A manager's view of one craftsman of the company: his calendar and his jobs. */
export default async function EmployeeLayout({ children, params }: LayoutProps<"/tabla/firma/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const viewer = await requireViewer(`/tabla/firma/${id}/kalendar`);
  if (id === viewer.id) redirect("/tabla/kalendar");

  const org = await getMyOrg();
  if (!org || !isManager(org)) redirect("/tabla/firma");
  const supabase = await createClient();
  const { data: team } = await supabase.rpc("org_team");
  const person = (team ?? []).find((m) => m.user_id === id && m.role === "craftsman");
  if (!person) notFound();

  return (
    <div className="grid gap-6">
      <div>
        <Link href="/tabla/firma" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> Към екипа
        </Link>
        <div className="mt-3 flex items-center gap-4">
          <Avatar name={person.name} url={person.avatar_url} size={56} />
          <div>
            <h1 className="display text-4xl sm:text-5xl">{person.name}</h1>
            <p className="text-ink-2">Работиш с календара и поръчките му от името на {org.name}.</p>
          </div>
        </div>
      </div>
      <EmployeeTabs id={id} />
      {children}
    </div>
  );
}
