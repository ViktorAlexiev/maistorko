/** Prototype data for „Поръчки“: jobs the craftsman wrote down himself and visits agreed in the chat, all relative to today. */

import { addDaysISO } from "@/lib/format";
import type { Client, Job, JobSource, JobStatus, Material } from "@/lib/jobs";

/** A visit agreed in the chat (table `bookings`, read with `my_bookings`). */
export type Booking = {
  id: string;
  conversation_id: string;
  booking_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  kind: "inspection" | "work";
  status: "proposed" | "confirmed";
  proposed_by_me: boolean;
  partner_name: string;
  note: string | null;
};

export const CLIENTS: Client[] = [
  { id: "c1", name: "Петър Димитров", phone: "0888 412 730", address: "ж.к. Люлин 5, бл. 512", note: null },
  { id: "c2", name: "Елена Стоянова", phone: "0897 220 145", address: null, note: null },
  { id: "c3", name: "Николай Вълчев", phone: null, address: "Банкя, ул. Иван Вазов 14", note: null },
  { id: "c4", name: "Иван Стоянов", phone: "0878 903 311", address: null, note: null },
];

let materialId = 0;
const mat = (name: string, qty: string | null, amount: number): Material => ({ id: `m${++materialId}`, name, qty, amount });

type Draft = {
  title: string;
  source: JobSource;
  /** days from today */
  day: number;
  /** last day, in days from today, for a job of several days */
  until?: number;
  time?: [string, string];
  status?: JobStatus;
  note?: string;
  client?: string;
  labor?: number;
  transport?: number;
  byClient?: boolean;
  materials?: Material[];
};

const DRAFTS: Draft[] = [
  { title: "Течащ сифон в банята", source: "phone", day: 0, time: ["08:00", "12:00"], note: "Да звънна, преди да тръгна" },
  {
    title: "Смяна на бойлер 80 л",
    source: "recommendation",
    day: 1,
    time: ["09:00", "11:00"],
    client: "c1",
    labor: 60,
    transport: 10,
    materials: [mat("Бойлер 80 л", "1 бр.", 189), mat("Меки връзки", "2 бр.", 12)],
    note: "Етаж 4, без асансьор",
  },
  { title: "Монтаж на шест контакта в кухня", source: "phone", day: 4, client: "c2", labor: 90 },
  {
    title: "Ремонт на баня",
    source: "facebook",
    day: 9,
    until: 13,
    client: "c3",
    labor: 850,
    byClient: true,
    note: "Плочките ги купува клиентът",
  },
  { title: "Смяна на смесител в кухня", source: "phone", day: -2, time: ["14:00", "16:00"], labor: 35 },
  { title: "Отпушване на канал", source: "other", day: -4 },
  {
    title: "Подмяна на ел. табло",
    source: "recommendation",
    day: -3,
    status: "done",
    client: "c4",
    labor: 220,
    materials: [mat("Табло за 12 модула", "1 бр.", 85), mat("Предпазители", "8 бр.", 55)],
  },
  { title: "Монтаж на три аплици", source: "phone", day: -6, time: ["17:00", "20:00"], status: "done", labor: 45 },
  {
    title: "Боядисване на таван",
    source: "recommendation",
    day: -8,
    status: "cancelled",
    labor: 120,
    note: "Клиентът отложи за пролетта",
  },
  { title: "Смяна на два ключа", source: "maistorko", day: -9, time: ["08:00", "12:00"], status: "done", labor: 30 },
  { title: "Оглед на покрив", source: "phone", day: -11, status: "cancelled" },
  { title: "Монтаж на бойлер", source: "phone", day: -20, status: "done", labor: 70, transport: 10 },
  { title: "Смяна на казанче", source: "recommendation", day: -27, time: ["12:00", "17:00"], status: "done", labor: 40 },
];

export function demoJobs(today: string): Job[] {
  return DRAFTS.map((d, i) => ({
    id: `j${i + 1}`,
    title: d.title,
    source: d.source,
    start_date: addDaysISO(today, d.day),
    end_date: addDaysISO(today, d.until ?? d.day),
    start_time: d.time?.[0] ?? null,
    end_time: d.time?.[1] ?? null,
    status: d.status ?? "planned",
    note: d.note ?? null,
    materials_by_client: d.byClient ?? false,
    labor_price: d.labor ?? null,
    transport_price: d.transport ?? null,
    client_id: d.client ?? null,
    done_at: null,
    materials: d.materials ?? [],
  }));
}

export function demoBookings(today: string): Booking[] {
  return [
    {
      id: "b1",
      conversation_id: "k1",
      booking_date: addDaysISO(today, 1),
      end_date: null,
      start_time: "14:00",
      end_time: "16:00",
      kind: "inspection",
      status: "confirmed",
      proposed_by_me: true,
      partner_name: "Мария Петрова",
      note: "Течащ кран в банята",
    },
    {
      id: "b2",
      conversation_id: "k2",
      booking_date: addDaysISO(today, 2),
      end_date: null,
      start_time: "10:00",
      end_time: "12:00",
      kind: "inspection",
      status: "proposed",
      proposed_by_me: false,
      partner_name: "Георги Ангелов",
      note: "Влага по стената в спалнята",
    },
    {
      id: "b3",
      conversation_id: "k3",
      booking_date: addDaysISO(today, 6),
      end_date: null,
      start_time: null,
      end_time: null,
      kind: "work",
      status: "proposed",
      proposed_by_me: true,
      partner_name: "Десислава Колева",
      note: "Смяна на ел. табло",
    },
  ];
}
