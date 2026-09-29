"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Live unread-message count. Listens to new messages and read-marker changes. */
export function UnreadBadge({ userId, initial }: { userId: string; initial: number }) {
  const [count, setCount] = useState(initial);
  const [prevInitial, setPrevInitial] = useState(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setCount(initial);
  }

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    const refresh = async () => {
      const { data } = await supabase.rpc("unread_total");
      if (alive && typeof data === "number") setCount(data);
    };
    const channel = supabase
      .channel(`unread-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, refresh)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "conversations" }, refresh)
      .subscribe();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("maistorko:read", onFocus);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("maistorko:read", onFocus);
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (!count) return null;
  return (
    <span className="numerals absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red px-1 text-[0.8rem] leading-none text-white ring-2 ring-paper">
      {count > 99 ? "99+" : count}
    </span>
  );
}
