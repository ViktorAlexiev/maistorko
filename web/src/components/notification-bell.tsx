"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CalendarClock, CalendarDays, Check, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/format";

export type NotificationItem = {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read_at: string | null;
};

const ICON: Record<string, typeof Bell> = { booking: CalendarClock, review: Star, calendar: CalendarDays };

/**
 * Bell with the latest notifications (bookings, reviews, calendar reminders). Messages have their own badge.
 * Updates live over Realtime.
 */
export function NotificationBell({ userId, initial, initialUnread }: { userId: string; initial: NotificationItem[]; initialUnread: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initial);
  const [unread, setUnread] = useState(initialUnread);
  const root = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const [{ data }, { count }] = await Promise.all([
      supabase
        .from("notifications")
        .select("id, kind, title, body, link, created_at, read_at")
        .neq("kind", "message")
        .order("created_at", { ascending: false })
        .limit(15),
      supabase.from("notifications").select("id", { count: "exact", head: true }).neq("kind", "message").is("read_at", null),
    ]);
    if (data) setItems(data as NotificationItem[]);
    if (typeof count === "number") setUnread(count);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`bell-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function read(ids?: number[]) {
    await createClient().rpc("mark_notifications_read", ids ? { p_ids: ids } : {});
    refresh();
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="btn btn-ghost btn-sm relative"
        aria-label={unread ? `Известия, ${unread} непрочетени` : "Известия"}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="numerals absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red px-1 text-[0.8rem] leading-none text-white ring-2 ring-paper">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="region"
          aria-label="Известия"
          className="unfold-down fixed inset-x-3 top-[4.25rem] z-50 max-h-[70dvh] overflow-y-auto rounded-[12px] border-[1.5px] border-ink bg-surface shadow-[var(--shadow-lg)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[24rem]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 className="font-extrabold">Известия</h2>
            {unread > 0 && (
              <button type="button" className="inline-flex items-center gap-1 text-sm font-bold underline underline-offset-4" onClick={() => read()}>
                <Check className="size-4" aria-hidden /> Прочетени
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-ink-2">Още няма известия. Тук ще виждаш уговорки, отзиви и напомняния.</p>
          ) : (
            <ul>
              {items.map((n) => {
                const Icon = ICON[n.kind] ?? Bell;
                const inner = (
                  <>
                    <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={`block ${n.read_at ? "font-semibold" : "font-extrabold"}`}>{n.title}</span>
                      {n.body && <span className="line-clamp-2 block text-sm text-ink-2">{n.body}</span>}
                      <span className="block text-xs text-ink-3">{timeAgo(n.created_at)}</span>
                    </span>
                    {!n.read_at && <span aria-label="непрочетено" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-red" />}
                  </>
                );
                const cls = "flex gap-3 border-b border-line px-4 py-3 transition-colors last:border-0 hover:bg-rule-soft/50";
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} className={cls} onClick={() => { setOpen(false); if (!n.read_at) read([n.id]); }}>
                        {inner}
                      </Link>
                    ) : (
                      <div className={cls}>{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
