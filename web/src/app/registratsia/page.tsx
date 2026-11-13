import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { getCities } from "@/lib/data";
import { todayISO } from "@/lib/format";
import { RegisterScreen } from "./register-screen";

export const metadata: Metadata = {
  title: "Регистрация",
  description: "Създайте профил на клиент или на майстор в Майсторлъка. Безплатно.",
};

export default async function RegisterPage({ searchParams }: PageProps<"/registratsia">) {
  const sp = await searchParams;
  if (await getViewer()) redirect("/tabla");
  const cities = await getCities();
  const role = sp.rolya === "maistor" ? "craftsman" : "client";
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/tabla";

  return <RegisterScreen initialRole={role} cities={cities} next={next} today={todayISO()} />;
}
