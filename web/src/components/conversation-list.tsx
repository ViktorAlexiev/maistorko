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
};

export function ConversationItem({ c, active = false }: { c: ConversationSummary; active?: boolean }) {
  const unread = c.unread_count > 0;
  return (
    <Link
      href={`/saobshtenia/${c.id}`}
      aria-current={active ? "page" : undefined}
      className={`flex gap-3 rounded-[8px] px-3 py-3 transition-colors ${
        active ? "bg-rule-soft" : "hover:bg-surface-2"
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
        <span className="numerals mt-1 grid h-6 min-w-6 place-items-center self-start rounded-full bg-red px-1.5 text-sm text-white">
          <span className="sr-only">Непрочетени: </span>
          {c.unread_count}
        </span>
      )}
    </Link>
  );
}
