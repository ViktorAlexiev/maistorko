import type { BookingData, Msg, OfferData } from "../razgovor/data";
import { formatDate } from "@/lib/format";
import { slotLabel, type Slot } from "@/lib/slots";

/** Content of the profile chat window prototype. Planning prototype: nothing here is saved. */

export type Scenario = 1 | 2 | 3 | 4;

export const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: 1, label: "Ново съобщение" },
  { id: 2, label: "Със снимки" },
  { id: 3, label: "Изпратено" },
  { id: 4, label: "Разговор" },
];

/** The prototype's „днес“ is сряда, 18 ноември, like the conversation prototype. */
export const TODAY = "2026-11-18";
/** a day the craftsman's calendar marks as busy: choosing it shows today's „Отбелязан като зает“ hint */
export const BUSY_DAYS = ["2026-11-21"];

export const CRAFTSMAN = {
  id: "stoyan-kolev",
  name: "Стоян Колев",
  first: "Стоян",
  category: "ВиК",
  place: "София",
  phone: "+359 887 640 312",
  /** the craftsman's main kinds of work: the price help asks questions for them */
  categories: [
    { slug: "vik", name: "ВиК" },
    { slug: "maistor-za-vsichko", name: "Майстор за всичко" },
  ],
};

export type WorkOption = { value: string; label: string; priced: boolean };

export const WORK_OPTIONS: WorkOption[] = [
  { value: "s:mesitel", label: "Смяна на смесител", priced: true },
  { value: "s:sifon", label: "Смяна на сифон", priced: true },
  { value: "s:otpushvane", label: "Отпушване на канал", priced: true },
  { value: "s:boiler", label: "Монтаж на бойлер", priced: true },
  { value: "c:tech", label: "Теч на тръба", priced: false },
  { value: "c:kazanche", label: "Ремонт на казанче", priced: false },
  { value: "c:druga", label: "Друга ВиК работа", priced: false },
];

export const workLabel = (value: string) => WORK_OPTIONS.find((o) => o.value === value)?.label ?? "";

export const DEMO_PHOTOS = ["/demo/work/pipes.svg", "/demo/work/bathroom.svg", "/demo/work/boiler.svg"];

export const DEMO_BODY =
  "Здравейте! Смесителят в банята тече при основата и не се затяга. Апартаментът е в Лозенец, на втория етаж. Удобно ли ви е в четвъртък сутринта?";

/** „четвъртък, 19 ноември, сутрин (до 12 ч.)“: the yellow date label of a first message */
export function dateLabel(date: string, slot: Slot | null) {
  const s = slot ? slotLabel(slot) : null;
  return `${formatDate(date, true)}${s ? `, ${s}` : ""}`;
}

/** The first message as it was sent: one message with its photos, work, date and text. */
export type SentData = {
  label?: string;
  work?: string;
  photos: { src: string; demo: boolean }[];
  body: string;
  time: string;
};

export const DEMO_SENT: SentData = {
  label: dateLabel("2026-11-19", "morning"),
  work: workLabel("s:mesitel"),
  photos: DEMO_PHOTOS.map((src) => ({ src, demo: true })),
  body: DEMO_BODY,
  time: "10:12",
};

/** the first message travels through the shared „Тихо“ thread as a message of this token and is drawn by the prototype */
export const FIRST_TOKEN = "first-message";

const OFFER: OfferData = {
  token: "7c1e5d2f-3a4b-4c8d-9e1f-6a7b8c9d0e1f",
  title: "Смяна на смесител",
  total: 60,
  lines: [
    { name: "Демонтаж на стария смесител", amount: 15, kind: "service" },
    { name: "Монтаж на нов смесител", amount: 35, kind: "service" },
    { name: "Уплътнения и свързващи шлангове", amount: 10, kind: "material" },
  ],
  status: "sent",
  validUntil: "5 декември",
  viewed: true,
};

const INSPECTION: BookingData = {
  kind: "inspection",
  date: "четвъртък, 19 ноември",
  weekday: "четвъртък",
  time: "09:00–11:00",
  rel: "утре",
  iso: "2026-11-19",
  status: "confirmed",
  past: false,
  by: "craftsman",
};

/** What the window shows after the first message: just that message (s=3), or an ongoing conversation (s=4). */
export function conversationMessages(sent: SentData, extended: boolean): Msg[] {
  const first: Msg = {
    t: "offer",
    id: "first",
    time: sent.time,
    o: { token: FIRST_TOKEN, title: "", total: 0, lines: [], status: "sent", validUntil: "", viewed: false },
  };
  if (!extended) return [{ t: "day", id: "d1", label: "днес" }, first];
  return [
    { t: "day", id: "d1", label: "вторник, 17 ноември" },
    first,
    {
      t: "text",
      id: "m2",
      from: "craftsman",
      time: "11:02",
      state: "sent",
      body: "Добър ден! Най-вероятно е само уплътнението, но трябва да го видя. Мога да мина на оглед в четвъртък между 9 и 11 ч.",
    },
    { t: "booking", id: "b1", from: "craftsman", time: "11:04", b: INSPECTION },
    { t: "text", id: "m3", from: "client", time: "11:20", state: "sent", body: "Добре, ще ви чакам в четвъртък. Входът е от задната страна." },
    { t: "day", id: "d2", label: "днес" },
    { t: "offer", id: "o1", time: "09:15", o: OFFER },
    { t: "text", id: "m4", from: "craftsman", time: "09:16", state: "sent", body: "Това е цената, ако е само смесителят. Ако намеря друго, ще ви кажа на огледа." },
  ];
}
