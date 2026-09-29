"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConversationItem, type ConversationSummary } from "@/components/conversation-list";

export function ConversationSidebar({ userId, initial }: { userId: string; initial: ConversationSummary[] }) {
  const pathname = usePathname();
  const activeId = pathname.split("/")[2];
  const [items, setItems] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setItems(initial);
  }

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    const refresh = async () => {
      const { data } = await supabase.rpc("my_conversations");
      if (alive && data) setItems(data as ConversationSummary[]);
    };
    const channel = supabase
      .channel(`convs-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, refresh)
      .subscribe();
    window.addEventListener("maistorko:read", refresh);
    return () => {
      alive = false;
      window.removeEventListener("maistorko:read", refresh);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <aside
      aria-label="Разговори"
      className={`min-h-0 flex-col border-line md:flex md:border-r ${activeId ? "hidden" : "flex"}`}
    >
      <div className="border-b border-line px-4 py-4">
        <h1 className="display text-4xl">Съобщения</h1>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {items.length ? (
          <ul className="grid gap-0.5">
            {items.map((c) => (
              <li key={c.id}>
                <ConversationItem c={c} active={c.id === activeId} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5 text-ink-2">
            <p className="font-bold text-ink">Още няма разговори.</p>
            <p className="mt-1">
              Разговор започва от профила на майстор с бутона „Пиши“.{" "}
              <Link href="/maistori" className="link font-semibold text-ink">
                Разгледай майсторите
              </Link>
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
