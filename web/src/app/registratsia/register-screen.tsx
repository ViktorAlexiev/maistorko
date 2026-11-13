"use client";

import { useState } from "react";
import { AuthMeter } from "@/components/auth-meter";
import { AuthShell } from "@/components/auth-shell";
import type { City } from "@/lib/data";
import { RegisterForm } from "./register-form";

/** Title, intro and meter follow the role chosen in the form, without a reload. */
export function RegisterScreen({
  initialRole,
  cities,
  next,
  today,
}: {
  initialRole: "client" | "craftsman";
  cities: City[];
  next: string;
  today: string;
}) {
  const [role, setRole] = useState<"client" | "craftsman">(initialRole);
  const screen = role === "craftsman" ? "maistor" : "klient";

  return (
    <AuthShell
      title={role === "craftsman" ? "Профил на майстор" : "Регистрация"}
      intro={
        role === "craftsman"
          ? "Безплатно е. След регистрацията избирате какво работите, цените си и свободните дни."
          : "Безплатно е. С профил можете да пишете на майстори и да запазвате любимите си."
      }
      aside={<AuthMeter key={screen} screen={screen} today={today} />}
    >
      <RegisterForm role={initialRole} cities={cities} next={next} onRoleChange={setRole} />
    </AuthShell>
  );
}
