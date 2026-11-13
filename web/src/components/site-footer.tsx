import Link from "next/link";
import { RuleMark } from "@/components/logo";
import { getViewer } from "@/lib/auth";

type FooterLinks = [string, string][];

const CITIES: FooterLinks = [
  ["/maistori?grad=sofia", "София"],
  ["/maistori?grad=plovdiv", "Пловдив"],
  ["/maistori?grad=varna", "Варна"],
  ["/maistori?grad=burgas", "Бургас"],
  ["/maistori?grad=ruse", "Русе"],
];

const FOR_CLIENTS: FooterLinks = [
  ["/maistori", "Всички майстори"],
  ["/kategorii", "Категории"],
  ["/registratsia", "Регистрация"],
  ["/kak-podrejdame", "Как подреждаме"],
];

// Class names are written out in full so Tailwind sees them. The brand column stays 1.4fr, each link column is 1fr.
const GRID_COLS: Record<number, string> = {
  2: "md:grid-cols-[1.4fr_1fr]",
  3: "md:grid-cols-[1.4fr_1fr_1fr]",
  4: "md:grid-cols-[1.4fr_1fr_1fr_1fr]",
};

export async function SiteFooter() {
  const viewer = await getViewer();

  const columns: { title: string; links: FooterLinks }[] = [];
  if (!viewer) {
    columns.push({ title: "За клиенти", links: FOR_CLIENTS });
    columns.push({
      title: "За майстори",
      links: [
        ["/registratsia?rolya=maistor", "Стани майстор"],
        ["/firmi", "За фирми"],
      ],
    });
  } else if (viewer.craftsmanSlug !== null) {
    columns.push({
      title: "За майстори",
      links: [
        ["/tabla/kalendar", "Моят календар"],
        ["/tabla/tseni", "Моите цени"],
        ["/firmi", "За фирми"],
      ],
    });
  } else {
    columns.push({
      title: "За клиенти",
      links: FOR_CLIENTS.filter(([href]) => href !== "/registratsia"),
    });
  }
  columns.push({ title: "Градове", links: CITIES });
  const visible = columns.filter((c) => c.links.length > 0);

  return (
    <footer className="on-dark mt-24 bg-graphite text-[#e9e6dc]">
      <div aria-hidden className="graduations graduations-top h-3.5 bg-rule" />
      <div className={`mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 ${GRID_COLS[visible.length + 1]}`}>
        <div>
          <div className="flex items-center gap-2">
            <RuleMark className="h-6 w-12" />
            <span className="display text-3xl font-black text-white">Майсторлъка</span>
          </div>
          <p className="mt-4 max-w-sm text-[#bdb8aa]">
            Виж кой може, колко струва и кога е свободен. После просто му пиши.
          </p>
        </div>
        {visible.map((c) => (
          <FooterCol key={c.title} title={c.title} links={c.links} />
        ))}
      </div>
      <div className="bg-[#141210]">
        <p className="mx-auto max-w-7xl px-4 py-5 text-sm text-[#9e998b] sm:px-6">
          © {new Date().getFullYear()} Майсторлъка. Календарът е ориентировъчен: майсторът потвърждава датата в чата.
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: FooterLinks }) {
  return (
    <div>
      <h2 className="font-bold text-white">{title}</h2>
      <ul className="mt-3 grid gap-2">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="text-[#cfcabd] hover:text-rule">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
