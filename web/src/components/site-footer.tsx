import Link from "next/link";
import { RuleMark } from "@/components/logo";

export function SiteFooter() {
  return (
    <footer className="on-dark mt-24 bg-graphite text-[#e9e6dc]">
      <div aria-hidden className="graduations graduations-top h-3.5 bg-rule" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <RuleMark className="h-6 w-12" />
            <span className="display text-3xl font-black text-white">Майсторко</span>
          </div>
          <p className="mt-4 max-w-sm text-[#bdb8aa]">
            Виж кой може, колко струва и кога е свободен. После просто му пиши.
          </p>
        </div>
        <FooterCol
          title="За клиенти"
          links={[
            ["/maistori", "Всички майстори"],
            ["/kategorii", "Категории"],
            ["/registratsia", "Регистрация"],
          ]}
        />
        <FooterCol
          title="За майстори"
          links={[
            ["/registratsia?rolya=maistor", "Стани майстор"],
            ["/tabla/kalendar", "Моят календар"],
            ["/tabla/tseni", "Моите цени"],
          ]}
        />
        <FooterCol
          title="Градове"
          links={[
            ["/maistori?grad=sofia", "София"],
            ["/maistori?grad=plovdiv", "Пловдив"],
            ["/maistori?grad=varna", "Варна"],
            ["/maistori?grad=burgas", "Бургас"],
            ["/maistori?grad=ruse", "Русе"],
          ]}
        />
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-5 text-sm text-[#9e998b] sm:px-6">
          © {new Date().getFullYear()} Майсторко. Календарът е ориентировъчен: майсторът потвърждава датата в чата.
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
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
