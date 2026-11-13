"use client";

import { LoginForm } from "@/app/vhod/login-form";
import { RegisterForm } from "@/app/registratsia/register-form";

export type Screen = "vhod" | "klient" | "maistor";
export type City = { slug: string; name: string; region: string; is_major: boolean };
export type VariantProps = { screen: Screen; today: string; form: React.ReactNode };

/** Titles and intros exactly as the product pages have them today. */
const HEAD: Record<Screen, { title: string; intro: string }> = {
  vhod: {
    title: "Вход",
    intro: "Влезте, за да пишете на майстори, да запазвате любимите си и да управлявате профила си.",
  },
  klient: {
    title: "Регистрация",
    intro: "Безплатно е. С профил можете да пишете на майстори и да запазвате любимите си.",
  },
  maistor: {
    title: "Профил на майстор",
    intro: "Безплатно е. След регистрацията избирате какво работите, цените си и свободните дни.",
  },
};

/** The form column: the real product forms, untouched. */
export function FormSide({ screen, nonce, cities }: { screen: Screen; nonce: number; cities: City[] }) {
  const { title, intro } = HEAD[screen];
  return (
    <>
      <h1 className="display text-5xl sm:text-6xl">{title}</h1>
      <p className="mt-3 text-lg text-ink-2">{intro}</p>
      <div className="mt-8">
        {screen === "vhod" ? (
          <LoginForm next="/tabla" />
        ) : (
          <RegisterForm key={nonce} role={screen === "maistor" ? "craftsman" : "client"} cities={cities} next="/tabla" />
        )}
      </div>
    </>
  );
}

/** The product's two-column auth layout. The side column hugs its content and follows the scroll beside a long form. */
export function Shell({
  form,
  aside,
  label,
  asideClass = "",
}: {
  form: React.ReactNode;
  aside: React.ReactNode;
  label: string;
  asideClass?: string;
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,28rem)_1fr] lg:gap-16">
      <div>{form}</div>
      <aside aria-label={label} className={`relative self-start lg:sticky lg:top-24 ${asideClass}`}>
        {aside}
      </aside>
    </div>
  );
}
