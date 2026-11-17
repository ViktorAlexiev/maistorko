import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { relativeDay, timeAgo } from "@/lib/format";

export type ConversationSummary = {
  id: string;
  i_am: string;
  partner_name: string;
  partner_avatar: string | null;
  requested_date: string | null;
  category_name: string | null;
  last_message_at: string;
  last_message_preview: string;
  last_from_me: boolean;
  unread_count: number;
  org_name?: string | null;
  assigned_name?: string | null;
};

/** The row list of the messages page and the dashboard. From md up: rows straight on the list pane, the open one Card Surface and flush into the conversation. Below md: Card Surface strips. With `home` the rows lie on a Panel Surface field. */
export function ConversationRows({
  items,
  activeId = null,
  lastId = null,
  home = false,
}: {
  items: ConversationSummary[];
  activeId?: string | null;
  lastId?: string | null;
  home?: boolean;
}) {
  return (
    <ul
      className={
        home
          ? "grid content-start gap-1 rounded-[10px] bg-surface-2 p-2"
          : "grid min-h-0 flex-1 content-start gap-1 overflow-y-auto p-2 md:p-0 md:pb-3 md:pl-2"
      }
    >
      {items.map((c) => (
        <li key={c.id} className={home ? undefined : c.id === activeId ? "md:pr-0" : "md:pr-2"}>
          <ConversationItem c={c} active={c.id === activeId} last={c.id === lastId} />
        </li>
      ))}
    </ul>
  );
}

export function ConversationItem({
  c,
  active = false,
  last = false,
}: {
  c: ConversationSummary;
  active?: boolean;
  last?: boolean;
}) {
  const unread = c.unread_count > 0;
  return (
    <Link
      href={`/saobshtenia/${c.id}`}
      aria-current={active ? "page" : undefined}
      className={`flex w-full gap-3 rounded-[6px] px-3 py-3 text-left ${
        active
          ? "bg-rule-soft md:rounded-r-none md:bg-surface"
          : last
            ? "bg-rule-soft hover:bg-paper md:bg-transparent"
            : "bg-surface hover:bg-paper md:bg-transparent"
      }`}
    >
      <Avatar name={c.partner_name} url={c.partner_avatar} size={44} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <p className={`truncate ${unread ? "font-extrabold" : "font-bold"}`}>{c.partner_name}</p>
          <time className="ml-auto shrink-0 text-xs text-ink-3" dateTime={c.last_message_at}>
            {timeAgo(c.last_message_at)}
          </time>
        </div>
        <p className={`truncate text-sm ${unread ? "font-semibold text-ink" : "text-ink-2"}`}>
          {c.last_from_me && <span className="text-ink-3">Вие: </span>}
          {c.last_message_preview}
        </p>
        {c.org_name && (
          <p className="mt-0.5 truncate text-xs font-bold text-ink-2">
            {c.i_am === "client" ? "Фирма" : `До ${c.org_name}`}
            {c.assigned_name ? ` · ${c.assigned_name}` : c.i_am === "client" ? "" : " · не е възложен"}
          </p>
        )}
        {(c.requested_date || c.category_name) && (
          <p className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-ink-3">
            {c.requested_date && (
              <>
                <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                {relativeDay(c.requested_date)}
              </>
            )}
            {c.requested_date && c.category_name && " · "}
            {c.category_name}
          </p>
        )}
      </div>
      {unread && (
        <span className="mt-[7px] size-2.5 shrink-0 self-start rounded-full bg-red shadow-[inset_0_0_0_1.5px_rgb(22_20_15/0.75)]">
          <span className="sr-only">Непрочетени</span>
        </span>
      )}
    </Link>
  );
}
