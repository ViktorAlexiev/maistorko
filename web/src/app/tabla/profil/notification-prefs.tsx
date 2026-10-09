"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export type Prefs = { email_messages: boolean; email_bookings: boolean; email_reviews: boolean; email_calendar: boolean };

const OPTIONS: { key: keyof Prefs; label: string; hint: string; craftsmanOnly?: boolean }[] = [
  { key: "email_messages", label: "Нови съобщения", hint: "Пращаме писмо само ако не си го прочел в сайта до 10 минути. Няколко съобщения са едно писмо." },
  { key: "email_bookings", label: "Уговорки", hint: "Предложена, потвърдена или отменена уговорка." },
  { key: "email_reviews", label: "Нови отзиви", hint: "Когато някой остави отзив за теб.", craftsmanOnly: true },
  { key: "email_calendar", label: "Напомняне за календара", hint: "Веднъж седмично, ако не си потвърждавал графика си.", craftsmanOnly: true },
];

export function NotificationPrefs({ userId, initial, isCraftsman }: { userId: string; initial: Prefs; isCraftsman: boolean }) {
  const [prefs, setPrefs] = useState(initial);

  async function toggle(key: keyof Prefs, value: boolean) {
    const previous = prefs;
    setPrefs({ ...prefs, [key]: value });
    const supabase = createClient();
    const { data: existing } = await supabase.from("notification_prefs").select("user_id").eq("user_id", userId).maybeSingle();
    const { error } = existing
      ? await supabase.from("notification_prefs").update({ [key]: value } as Partial<Prefs>).eq("user_id", userId)
      : await supabase.from("notification_prefs").insert({ user_id: userId, [key]: value } as Partial<Prefs> & { user_id: string });
    if (error) {
      setPrefs(previous);
      toast.error("Не успяхме да запишем промяната.");
    } else toast.success(value ? "Ще получаваш такива писма." : "Спряно.");
  }

  return (
    <section aria-labelledby="notif-heading" className="grid gap-4 rounded-[10px] border border-line bg-surface p-5">
      <div>
        <h2 id="notif-heading" className="text-xl font-extrabold">
          Писма на имейла
        </h2>
        <p className="text-sm text-ink-2">Известията в сайта (камбанката) винаги работят. Тук избираш кое да идва и по имейл.</p>
      </div>
      <ul className="grid gap-3">
        {OPTIONS.filter((o) => !o.craftsmanOnly || isCraftsman).map((o) => (
          <li key={o.key}>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" className="check mt-0.5" checked={prefs[o.key]} onChange={(e) => toggle(o.key, e.target.checked)} />
              <span>
                <span className="font-bold">{o.label}</span>
                <span className="block text-sm text-ink-2">{o.hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
