import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import { UnreadBadge } from "@/components/unread-badge";
import { UserMenu } from "@/components/user-menu";
import { MobileMenu } from "@/components/mobile-menu";

const NAV = [
  { href: "/maistori", label: "Майстори" },
  { href: "/kategorii", label: "Категории" },
  { href: "/#kak-raboti", label: "Как работи" },
];

export async function SiteHeader() {
  const viewer = await getViewer();
  let unread = 0;
  if (viewer) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("unread_total");
    unread = data ?? 0;
  }
  const displayName = viewer?.profile.full_name || viewer?.email || "";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/92 backdrop-blur-md supports-[backdrop-filter]:bg-paper/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Основна навигация" className="ml-6 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="btn btn-ghost btn-sm font-semibold">
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {viewer ? (
            <>
              <Link
                href="/saobshtenia"
                className="btn btn-ghost btn-sm relative"
                aria-label={unread ? `Съобщения, ${unread} непрочетени` : "Съобщения"}
              >
                <MessageCircle className="size-5" aria-hidden />
                <span className="hidden sm:inline">Съобщения</span>
                <UnreadBadge userId={viewer.id} initial={unread} />
              </Link>
              <UserMenu
                name={displayName}
                role={viewer.profile.role}
                avatarUrl={viewer.profile.avatar_url}
                craftsmanSlug={viewer.craftsmanSlug}
              />
            </>
          ) : (
            <>
              <Link href="/vhod" className="btn btn-ghost btn-sm hidden sm:inline-flex">
                Вход
              </Link>
              <Link href="/registratsia?rolya=maistor" className="btn btn-primary btn-sm hidden sm:inline-flex">
                Стани майстор
              </Link>
            </>
          )}
          <MobileMenu signedIn={Boolean(viewer)} nav={NAV} />
        </div>
      </div>
    </header>
  );
}
