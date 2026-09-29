import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { AuthShell } from "@/components/auth-shell";
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
      aside={
        <div className="mt-10 max-w-sm">
          <p className="display text-5xl">Добре дошли отново.</p>
          <p className="mt-4 text-lg">Съобщенията ви чакат там, където ги оставихте.</p>
        </div>
      }
    >
      <LoginForm next={next} />
    </AuthShell>
  );
}
