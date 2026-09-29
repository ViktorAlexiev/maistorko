import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getCities } from "@/lib/data";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Регистрация",
  description: "Създайте профил на клиент или на майстор в Майсторко. Безплатно.",
};

export default async function RegisterPage({ searchParams }: PageProps<"/registratsia">) {
  const sp = await searchParams;
  if (await getViewer()) redirect("/tabla");
  const cities = await getCities();
  const role = sp.rolya === "maistor" ? "craftsman" : "client";
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/tabla";

  return (
    <AuthShell
      title={role === "craftsman" ? "Профил на майстор" : "Регистрация"}
      intro={
        role === "craftsman"
          ? "Безплатно е. След регистрацията избирате какво работите, цените си и свободните дни."
          : "Безплатно е. С профил можете да пишете на майстори и да запазвате любимите си."
      }
      aside={
        <ol className="mt-10 grid max-w-sm gap-6">
          {(role === "craftsman"
            ? [
                ["Какво работиш", "Категории и градове, в които пътуваш."],
                ["Колко струва", "Цена на час, на услуга или „по оглед“."],
                ["Кога си свободен", "Седмичен график и бързи бутони за заети дни."],
              ]
            : [
                ["Търсиш", "По вид работа, град и дата."],
                ["Сравняваш", "Цени, отзиви и свободни дни."],
                ["Пишеш", "Директно на майстора, в чата."],
              ]
          ).map(([t, d]) => (
            <li key={t} className="border-t-[1.5px] border-ink pt-3">
              <p className="display text-3xl">{t}</p>
              <p className="mt-1">{d}</p>
            </li>
          ))}
        </ol>
      }
    >
      <RegisterForm role={role} cities={cities} next={next} />
    </AuthShell>
  );
}
