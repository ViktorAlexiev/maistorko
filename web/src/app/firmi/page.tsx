import type { Metadata } from "next";
import { CalendarDays, Users, BarChart3, ShieldCheck, Check } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "За фирми",
  description: "Майсторлъка за фирми с няколко майстори: общ календар, разпределение на поръчки, статистика и фирмен профил.",
  alternates: { canonical: "/firmi" },
};

const BENEFITS = [
  { icon: CalendarDays, title: "Общ календар на екипа", text: "Виждаш кой от майсторите ти е свободен и кога, и разпределяш работата на едно място." },
  { icon: Users, title: "Всеки майстор има свой профил", text: "Клиентите избират конкретен човек по свободни дни, отзиви и цени. Отзивите остават на майстора, който ги е заслужил." },
  { icon: BarChart3, title: "Статистика и отчети", text: "Прегледи, запитвания, уговорки и приходи за целия екип, и отделно за всеки майстор." },
  { icon: ShieldCheck, title: "Фирмен профил с проверка", text: "Страница на фирмата с всички майстори, ЕИК и значка „Проверена фирма“ след проверка в Търговския регистър." },
];

const STEPS = [
  "Пишете ни през формата по-долу. Разговаряме и се договаряме за условията.",
  "Създаваме фирмата ви и давате достъп на собственика.",
  "Добавяте майсторите си: за всеки изпращате покана с вече попълнено име. Той я отваря, задава парола и профилът му е готов.",
  "Разпределяте поръчките и следите календара на екипа.",
];

export default async function CompaniesPage() {
  const viewer = await getViewer();
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="display text-5xl sm:text-7xl">Майсторлъка за фирми</h1>
      <p className="mt-4 max-w-2xl text-xl text-ink-2">
        Имате няколко майстори? Дайте им общ календар и профили, през които клиентите ги намират по свободни дни. Условията се договарят с
        вас, а за по-голям екип има намаление.
      </p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="rounded-[10px] border border-line bg-surface p-5">
            <Icon className="size-7" strokeWidth={1.6} aria-hidden />
            <h2 className="mt-3 text-xl font-extrabold">{title}</h2>
            <p className="mt-1 text-ink-2">{text}</p>
          </li>
        ))}
      </ul>

      <section aria-labelledby="how" className="mt-14">
        <h2 id="how" className="display text-4xl">
          Как става
        </h2>
        <ol className="mt-4 grid gap-3">
          {STEPS.map((s, i) => (
            <li key={s} className="flex gap-4 border-b border-line pb-3">
              <span className="numerals text-4xl leading-none">{i + 1}</span>
              <p className="pt-1 text-lg">{s}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="fair" className="mt-14 rounded-[10px] bg-rule-soft p-6">
        <h2 id="fair" className="display text-3xl">
          Честно за всички
        </h2>
        <ul className="mt-3 grid gap-2">
          {[
            "Подреждането на майсторите е еднакво за фирмите и за самостоятелните майстори. Не се продава място в него.",
            "Не повече от двама майстори от една фирма един до друг, за да остане място и за останалите.",
            "Платените места, ако въведем такива, са ясно отбелязани и се показват само при подходящо търсене.",
          ].map((t) => (
            <li key={t} className="flex gap-2.5">
              <Check className="mt-1 size-5 shrink-0" aria-hidden />
              {t}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink-2">
          Подробностите са на страницата{" "}
          <a href="/kak-podrejdame" className="link font-semibold">
            Как подреждаме
          </a>
          .
        </p>
      </section>

      <section id="kontakt" aria-labelledby="contact-h" className="mt-14 scroll-mt-24">
        <h2 id="contact-h" className="display text-4xl">
          Свържете се с нас
        </h2>
        <p className="mt-2 max-w-2xl text-ink-2">Разкажете ни за фирмата си. Отговаряме в рамките на работен ден.</p>
        <div className="mt-5 max-w-3xl rounded-[10px] border border-line bg-surface p-5">
          <ContactForm
            kind="company"
            defaultName={viewer?.profile.full_name ?? ""}
            defaultContact={viewer?.email ?? ""}
            extra={[
              { name: "company", label: "Име на фирмата", required: true },
              { name: "eik", label: "ЕИК (по желание)" },
              { name: "city", label: "Град" },
              { name: "workers", label: "Колко майстори имате", type: "number" },
              { name: "trades", label: "Професии", placeholder: "напр. ВиК, ел. инсталации" },
            ]}
            messageLabel="Какво ви трябва"
            button="Изпрати запитване"
            success="Благодарим! Ще се свържем с вас до един работен ден."
          />
        </div>
      </section>
    </div>
  );
}
