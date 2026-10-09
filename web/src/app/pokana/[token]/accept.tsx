"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

export function AcceptInvite({ token, role }: { token: string; role: "owner" | "manager" | "craftsman"; orgSlug: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    start(async () => {
      const { error: e } = await createClient().rpc("claim_org_invite", { p_token: token });
      if (e) return void setError(e.message);
      // a new craftsman completes the profile; owners and managers go to the company
      router.push(role === "craftsman" ? "/tabla/profil?nov=1" : "/tabla/firma");
      router.refresh();
    });
  }

  return (
    <div className="mt-6 grid gap-3">
      <button type="button" className="btn btn-primary btn-lg" onClick={accept} disabled={pending}>
        {pending ? "Приемаме…" : "Приемам поканата"}
      </button>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}
