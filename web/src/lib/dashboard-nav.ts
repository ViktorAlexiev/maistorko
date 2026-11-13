export type NavItem = { href: string; label: string };

export type DashboardNavData = {
  /** The desktop list; groups are separated by space. */
  groups: NavItem[][];
  /** The phone bottom bar, in order. */
  bar: NavItem[];
  /** The „Още“ sheet: groups without the items in `bar` (by href), empty groups dropped; [] = no „Още“. */
  more: NavItem[][];
  publicHref: string | null;
};

const item = (href: string, label: string): NavItem => ({ href, label });

export function dashboardNav({ craftsmanSlug, inOrg }: { craftsmanSlug: string | null; inOrg: boolean }): DashboardNavData {
  const firma = inOrg ? [item("/tabla/firma", "Фирма")] : [];
  const pregled = item("/tabla", "Преглед");
  const saobshtenia = item("/saobshtenia", "Съобщения");
  const profil = item("/tabla/profil", "Профил");

  let groups: NavItem[][];
  let bar: NavItem[];
  if (craftsmanSlug) {
    const kalendar = item("/tabla/kalendar", "Календар");
    const porachki = item("/tabla/porachki", "Поръчки");
    groups = [
      [pregled, kalendar, saobshtenia, porachki, item("/tabla/klienti", "Клиенти"), item("/tabla/oferti", "Оферти")],
      [
        item("/tabla/tseni", "Цени и услуги"),
        item("/tabla/snimki", "Снимки"),
        item("/tabla/statistika", "Статистика"),
        item("/tabla/link", "Моят линк"),
      ],
      [item("/tabla/plan", "План"), ...firma, profil],
    ];
    bar = [pregled, kalendar, saobshtenia, porachki];
  } else {
    groups = [[pregled, item("/tabla/zapazeni", "Запазени майстори"), saobshtenia, ...firma, profil]];
    bar = [pregled, item("/tabla/zapazeni", "Запазени"), saobshtenia, profil];
  }

  const inBar = new Set(bar.map((b) => b.href));
  const more = groups.map((g) => g.filter((it) => !inBar.has(it.href))).filter((g) => g.length > 0);

  return {
    groups,
    bar,
    more,
    publicHref: craftsmanSlug ? `/maistori/${craftsmanSlug}` : null,
  };
}

/** "/tabla" and "/admin" are current only on an exact match (otherwise they would light up on every subpage); the others on a pathname prefix. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/tabla" || href === "/admin") return pathname === href;
  return pathname.startsWith(href);
}
