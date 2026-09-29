"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CalendarCheck, CalendarClock, CalendarX, Search, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { formatDate, relativeDay, todayISO } from "@/lib/format";
import { SLOT_DEFS, type Range } from "@/lib/slots";

export type Booking = {
  id: string;
  booking_date: string;
  start_time: string | null;
  end_time: string | null;
  kind: "inspection" | "work";
  status: "proposed" | "confirmed" | "declined" | "cancelled";
  note: string | null;
  proposed_by: string;
  craftsman_id: string;
  client_id: string;
};

export const KIND_LABEL = { inspection: "Оглед", work: "Работа" } as const;

export function bookingWhen(b: Pick<Booking, "booking_date" | "start_time" | "end_time">) {
  const t = b.start_time ? `${b.start_time.slice(0, 5)}–${b.end_time!.slice(0, 5)}` : "цял ден";
  return `${formatDate(b.booking_date, true)}, ${t}`;
}

const STATUS = {
  proposed: { label: "Чака потвърждение", cls: "bg-rule-soft text-ink" },
  confirmed: { label: "Уговорено", cls: "bg-free text-white" },
  declined: { label: "Отказано", cls: "bg-surface-2 text-ink-2" },
  cancelled: { label: "Отменено", cls: "bg-surface-2 text-ink-2" },
} as const;

/** Live card for one booking, shown where it was proposed in the chat. */
export function BookingCard({
  booking,
  me,
  partnerName,
  onChanged,
}: {
  booking: Booking;
  me: string;
  partnerName: string;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [pending, start] = useTransition();
  const mineProposal = booking.proposed_by === me;
  const iAmCraftsman = booking.craftsman_id === me;
  const st = STATUS[booking.status];
  const Icon = booking.status === "confirmed" ? CalendarCheck : booking.status === "proposed" ? CalendarClock : CalendarX;

  const act = (action: "confirm" | "decline" | "cancel", confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    start(async () => {
      const { error } = await supabase.rpc("respond_booking", { p_booking: booking.id, p_action: action });
      if (error) toast.error(error.message);
      else
        toast.success(
          action === "confirm" ? "Уговорката е потвърдена и е в календара." : action === "decline" ? "Отказахте." : "Уговорката е отменена.",
        );
      onChanged();
    });
  };

  return (
    <div
      className={`mx-auto my-2 w-full max-w-md overflow-hidden rounded-[10px] border-[1.5px] bg-surface ${
        booking.status === "confirmed" ? "border-free" : booking.status === "proposed" ? "border-ink" : "border-line"
      }`}
    >
      <div aria-hidden className="graduations graduations-top h-2 bg-rule" />
      <div className="p-3.5">
        <div className="flex items-start gap-3">
          <Icon className="mt-0.5 size-6 shrink-0" strokeWidth={1.75} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink-2">{KIND_LABEL[booking.kind]}</p>
            <p className={`text-lg font-extrabold first-letter:uppercase ${booking.status === "cancelled" || booking.status === "declined" ? "line-through decoration-2 opacity-60" : ""}`}>
              {bookingWhen(booking)}
            </p>
            {booking.note && <p className="mt-1 text-sm text-ink-2">{booking.note}</p>}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${st.cls}`}>{st.label}</span>
        </div>

        {booking.status === "proposed" && !mineProposal && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button type="button" className="btn bg-free text-white hover:bg-free/90" disabled={pending} onClick={() => act("confirm")}>
              Потвърди
            </button>
            <button type="button" className="btn btn-outline" disabled={pending} onClick={() => act("decline")}>
              Не мога
            </button>
          </div>
        )}
        {booking.status === "proposed" && mineProposal && (
          <div className="mt-3 flex items-center justify-between gap-2 text-sm text-ink-2">
            <span>Чакаме отговор от {partnerName.split(" ")[0]}.</span>
            <button type="button" className="font-bold underline" disabled={pending} onClick={() => act("cancel")}>
              Оттегли
            </button>
          </div>
        )}
        {booking.status === "confirmed" && (
          <div className="mt-3 flex items-center justify-between gap-2 text-sm text-ink-2">
            <span>{iAmCraftsman ? "Часът е зает в календара ти." : "Часът е запазен в календара на майстора."}</span>
            <button
              type="button"
              className="font-bold text-danger underline"
              disabled={pending}
              onClick={() => act("cancel", "Да отменя ли уговорката? Другата страна ще види съобщение.")}
            >
              Отмени
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const PRESETS = [
  { key: "day", label: "Цял ден", from: null, to: null },
  ...SLOT_DEFS.map((s) => ({
    key: s.key,
    label: s.label,
    from: s.key === "morning" ? "08:00" : s.key === "afternoon" ? "12:00" : "17:00",
    to: s.key === "morning" ? "12:00" : s.key === "afternoon" ? "17:00" : "20:00",
  })),
  { key: "custom", label: "Точни часове", from: "09:00", to: "11:00" },
] as const;

/** Bottom sheet to propose (client) or save (craftsman) a visit. */
export function BookingSheet({
  open,
  onClose,
  conversationId,
  craftsmanId,
  iAmCraftsman,
  partnerName,
  defaultDate,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  craftsmanId: string;
  iAmCraftsman: boolean;
  partnerName: string;
  defaultDate: string | null;
  onCreated: () => void;
}) {
  const supabase = createClient();
  const ref = useRef<HTMLDialogElement>(null);
  const [today] = useState(todayISO);
  const [kind, setKind] = useState<"inspection" | "work">("inspection");
  const [date, setDate] = useState(defaultDate && defaultDate >= today ? defaultDate : today);
  const [preset, setPreset] = useState<(typeof PRESETS)[number]["key"]>("morning");
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("11:00");
  const [note, setNote] = useState("");
  const [free, setFree] = useState<Range[] | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  useEffect(() => {
    if (!open || !date) return;
    let alive = true;
    supabase.rpc("availability_days", { p_craftsman: craftsmanId, p_from: date, p_days: 1 }).then(({ data }) => {
      if (alive) setFree(((data?.[0]?.ranges ?? []) as Range[]) || []);
    });
    return () => {
      alive = false;
    };
  }, [open, date, craftsmanId, supabase]);

  const p = PRESETS.find((x) => x.key === preset)!;
  const startTime = preset === "custom" ? from : p.from;
  const endTime = preset === "custom" ? to : p.to;
  const invalid = Boolean(startTime && endTime && endTime <= startTime);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (invalid) return;
    start(async () => {
      const { error } = await supabase.rpc("propose_booking", {
        p_conversation: conversationId,
        p_date: date,
        p_start: startTime ?? undefined,
        p_end: endTime ?? undefined,
        p_kind: kind,
        p_note: note.trim() || undefined,
      });
      if (error) return void toast.error(error.message);
      toast.success(iAmCraftsman ? "Запазено в календара ти." : `Изпратено. ${partnerName.split(" ")[0]} трябва да потвърди.`);
      setNote("");
      onCreated();
      onClose();
    });
  }

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="bk-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
    >
      <form onSubmit={submit} className="safe-bottom grid max-h-[88dvh] gap-4 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="bk-title" className="display text-4xl">
              {iAmCraftsman ? "Запази час" : "Предложи час"}
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              {iAmCraftsman
                ? "Интервалът веднага става зает в календара ти и клиентът вижда уговорката в чата."
                : `${partnerName.split(" ")[0]} ще потвърди и тогава часът става зает в календара му.`}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current?.close()} aria-label="Затвори">
            <X className="size-6" aria-hidden />
          </button>
        </div>

        <fieldset>
          <legend className="label">Какво се уговаряте?</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["inspection", "work"] as const).map((k) => (
              <button key={k} type="button" className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
                {k === "inspection" ? (
                  <>
                    <Search className="size-4" aria-hidden /> Оглед
                  </>
                ) : (
                  "Работа"
                )}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="bk-date" className="label">
            Ден
          </label>
          <input
            id="bk-date"
            type="date"
            className="field"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
          <p className="hint">
            {free === null
              ? "Проверяваме свободните часове…"
              : free.length
                ? `Свободен ${relativeDay(date)}: ${free.map((r) => `${r.start}–${r.end}`).join(", ")}`
                : `${relativeDay(date)[0].toUpperCase()}${relativeDay(date).slice(1)} е отбелязан като зает. Може да се уговорите все пак.`}
          </p>
        </div>

        <fieldset>
          <legend className="label">Час</legend>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((x) => (
              <button key={x.key} type="button" className="chip" aria-pressed={preset === x.key} onClick={() => setPreset(x.key)}>
                {x.label}
                {x.from && x.key !== "custom" && <span className="text-xs font-medium opacity-75">{x.from.slice(0, 2)}–{x.to!.slice(0, 2)}</span>}
              </button>
            ))}
          </div>
          {preset === "custom" && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="bk-from" className="text-sm font-semibold text-ink-2">
                  От
                </label>
                <input id="bk-from" type="time" step={900} className="field mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label htmlFor="bk-to" className="text-sm font-semibold text-ink-2">
                  До
                </label>
                <input
                  id="bk-to"
                  type="time"
                  step={900}
                  className="field mt-1"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  aria-invalid={invalid}
                />
              </div>
            </div>
          )}
          {invalid && <p className="error-text">Краят трябва да е след началото.</p>}
        </fieldset>

        <div>
          <label htmlFor="bk-note" className="label">
            Бележка <span className="font-normal text-ink-3">(по желание)</span>
          </label>
          <input
            id="bk-note"
            className="field"
            maxLength={300}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={kind === "inspection" ? "напр. ул. Родопи 12, ет. 4, звънец Иванови" : "напр. нося материалите"}
          />
        </div>

        <button type="submit" className="btn btn-primary btn-lg" disabled={pending || invalid}>
          {pending ? "Изпращаме…" : iAmCraftsman ? "Запази в календара" : "Изпрати предложение"}
        </button>
      </form>
    </dialog>
  );
}
