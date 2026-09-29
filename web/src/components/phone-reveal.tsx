"use client";

import Link from "next/link";
import { useState } from "react";
import { Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  craftsmanId: string;
  firstName: string;
  hasPhone: boolean;
  visibility: string;
  signedIn: boolean;
  loginHref: string;
};

/**
 * The phone number is never in the page HTML. It is fetched on click from `craftsman_phone`,
 * which applies the craftsman's own visibility choice on the server.
 */
export function PhoneReveal({ craftsmanId, firstName, hasPhone, visibility, signedIn, loginHref }: Props) {
  const [phone, setPhone] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "denied">("idle");

  if (!hasPhone || visibility === "hidden") {
    return <p className="text-ink-2">Само през чата в сайта.</p>;
  }
  if (phone) {
    return (
      <a href={`tel:${phone.replace(/\s/g, "")}`} className="btn btn-outline w-full justify-start">
        <Phone className="size-4" aria-hidden />
        <span className="numerals text-xl">{phone}</span>
      </a>
    );
  }
  if (visibility === "login" && !signedIn) {
    return (
      <p className="text-ink-2">
        <Link href={loginHref} className="link font-bold">
          Влезте
        </Link>
        , за да видите телефона.
      </p>
    );
  }
  if (visibility === "chat" && !signedIn) {
    return <p className="text-ink-2">Телефонът се вижда, след като {firstName} ви отговори в чата.</p>;
  }

  async function reveal() {
    setState("loading");
    const { data } = await createClient().rpc("craftsman_phone", { p_craftsman: craftsmanId });
    if (data) setPhone(data);
    else setState("denied");
  }

  return (
    <div className="grid gap-1.5">
      <button type="button" className="btn btn-outline w-full justify-start" onClick={reveal} disabled={state === "loading"}>
        <Phone className="size-4" aria-hidden />
        {state === "loading" ? "Зареждаме…" : "Покажи телефона"}
      </button>
      {state === "denied" ? (
        <p className="text-sm text-ink-2">
          {visibility === "chat"
            ? `${firstName} показва телефона си, след като отговори в чата.`
            : "Телефонът не е достъпен в момента."}
        </p>
      ) : (
        visibility === "chat" && <p className="text-sm text-ink-3">Вижда се, след като {firstName} ви отговори в чата.</p>
      )}
    </div>
  );
}
