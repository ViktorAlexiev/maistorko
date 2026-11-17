"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { ConversationRows, type ConversationSummary } from "@/components/conversation-list";

const LAST_KEY = "maistorko:last-conversation";

function readLast() {
  try {
    return sessionStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

const noop = () => () => {};

export function ConversationSidebar({ userId, initial }: { userId: string; initial: ConversationSummary[] }) {
  const pathname = usePathname();
  const activeId = pathname.split("/")[2];
  const [items, setItems] = useState(initial);
  const [q, setQ] = useState("");
  const last = useSyncExternalStore(noop, readLast, () => null);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setItems(initial);
  }

  useEffect(() => {
    if (!activeId) return;
    try {
      sessionStorage.setItem(LAST_KEY, activeId);
    } catch {}
  }, [activeId]);

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

  const rows = items.filter((c) => c.partner_name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <aside aria-label="Разговори" className={`min-h-0 flex-col bg-surface-2 md:flex ${activeId ? "hidden" : "flex"}`}>
      <div className="flex items-center gap-3 bg-surface px-3 py-2 md:hidden">
        <h1 className="display shrink-0 text-3xl">Съобщения</h1>
        <label htmlFor="conversation-search" className="sr-only">
          Търси разговор по име
        </label>
        <input
          id="conversation-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Търси по име"
          className="field min-h-11 min-w-0 flex-1 py-1.5"
        />
      </div>
      <h1 className="display hidden px-4 pb-3 pt-4 text-4xl md:block">Съобщения</h1>
      {items.length ? (
        <>
          <ConversationRows items={rows} activeId={activeId ?? null} lastId={activeId ? null : last} />
          {rows.length === 0 && <p className="p-4 text-center text-ink-2">Няма разговор с това име.</p>}
        </>
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
    </aside>
  );
}
