import Link from "next/link";
import { CalendarCheck, CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { formatDate, relativeDay } from "@/lib/format";

/** Upcoming agreed and pending visits for the signed-in user, linking back to the chat. */
export async function UpcomingBookings({ title = "Уговорки", limit = 8 }: { title?: string; limit?: number }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_bookings", {});
  const rows = (data ?? []).slice(0, limit);

  return (
    <section aria-labelledby="bookings-heading">
      <h2 id="bookings-heading" className="display text-4xl">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-ink-2">
          Още няма уговорени посещения. Когато се разберете в чата за ден, натиснете „Уговорка“ и часът се
          записва тук и в календара.
        </p>
      ) : (
        <ul className="stagger mt-3 grid border-t-[1.5px] border-ink">
          {rows.map((b) => {
            const confirmed = b.status === "confirmed";
            const waitingForMe = b.status === "proposed" && !b.proposed_by_me;
            return (
              <li key={b.id}>
                <Link
                  href={`/saobshtenia/${b.conversation_id}`}
                  className="flex items-center gap-3 border-b border-line px-1 py-3 transition-colors hover:bg-rule-soft/50"
                >
                  {confirmed ? (
                    <CalendarCheck className="size-5 shrink-0 text-free" aria-hidden />
                  ) : (
                    <CalendarClock className="size-5 shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">
                      {cap(relativeDay(b.booking_date))}
                      {b.start_time ? `, ${b.start_time.slice(0, 5)}–${b.end_time!.slice(0, 5)}` : ", цял ден"}
                      <span className="font-semibold text-ink-2"> · {b.kind === "inspection" ? "оглед" : "работа"}</span>
                    </span>
                    <span className="block truncate text-sm text-ink-3">
                      {b.partner_name} · {formatDate(b.booking_date)}
                      {b.note ? ` · ${b.note}` : ""}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                      confirmed ? "bg-free text-white" : waitingForMe ? "bg-red text-white" : "bg-rule-soft"
                    }`}
                  >
                    {confirmed ? "Уговорено" : waitingForMe ? "Отговори" : "Чака отговор"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
