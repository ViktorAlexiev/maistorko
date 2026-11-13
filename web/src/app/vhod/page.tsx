import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { AuthMeter } from "@/components/auth-meter";
import { AuthShell } from "@/components/auth-shell";
import { todayISO } from "@/lib/format";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Вход", robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<"/vhod">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/tabla";
  if (await getViewer()) redirect(next);

  return (
    <AuthShell
      title="Вход"
      intro="Влезте, за да пишете на майстори, да запазвате любимите си и да управлявате профила си."
      aside={<AuthMeter screen="vhod" today={todayISO()} />}
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
