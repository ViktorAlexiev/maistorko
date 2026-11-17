/** The one conversation behind all three variants of „Разговорът“. Planning prototype: nothing here is saved. */

export type Scenario = 1 | 2 | 3;
export type Role = "craftsman" | "client";

export const SCENARIOS: { id: Scenario; label: string; viewer: Role }[] = [
  { id: 1, label: "Майстор · огледът е утре", viewer: "craftsman" },
  { id: 2, label: "Майстор · огледът мина", viewer: "craftsman" },
  { id: 3, label: "Клиент · огледът мина", viewer: "client" },
];

export const PEOPLE = {
  craftsman: { name: "Георги Петров", first: "Георги", phone: "+359 899 555 010", trade: "електротехник" },
  client: { name: "Мария Иванова", first: "Мария", phone: "+359 888 123 456", trade: "" },
} as const;

export const CATEGORY = "Осветление";
export const PLACE = "Лозенец";

export type BookingData = {
  kind: "inspection" | "work";
  /** "четвъртък, 19 ноември" */
  date: string;
  weekday: string;
  /** "09:00–11:00" */
  time: string;
  /** "утре" when the day is tomorrow; otherwise the bar says „в <weekday>“ */
  rel?: string;
  /** sort key of the day */
  iso: string;
  status: "proposed" | "confirmed" | "declined" | "cancelled";
  past: boolean;
  /** who proposed it */
  by: Role;
  note?: string;
};

export type Msg =
  | { t: "day"; id: string; label: string }
  | {
      t: "text";
      id: string;
      from: Role;
      body: string;
      time: string;
      /** the yellow date label of the first message */
      label?: string;
      photos?: string[];
      state: "sent" | "sending" | "failed";
    }
  | { t: "booking"; id: string; from: Role; time: string; b: BookingData }
  | { t: "offer"; id: string; time: string; title: string; total: number }
  | { t: "invite"; id: string; time: string; body: string };

export const INVITE_BODY = "Работата е свършена. Ще се радвам на кратък отзив.";

export const QUICK_DEFAULTS = ["Идвам утре в 10", "Прати снимка на проблема", "Цената е от … до …", "Кога ти е удобно?"];
export const QUICK_OWN = [{ id: "own-1", body: "Благодаря, ще се чуем утре" }];

export const PHOTOS = ["/demo/work/lighting.svg", "/demo/work/electrical-panel.svg"];

/** The line under the name: which day and which kind of work the conversation is about. */
export function aboutLine(s: Scenario) {
  return s === 1 ? `Оглед в четвъртък, 19 ноем · ${CATEGORY}` : `Оглед в четвъртък, 19 ноем (минал) · ${CATEGORY}`;
}

const inspection = (past: boolean): BookingData => ({
  kind: "inspection",
  date: "четвъртък, 19 ноември",
  weekday: "четвъртък",
  time: "09:00–11:00",
  rel: past ? undefined : "утре",
  iso: "2026-11-19",
  status: "confirmed",
  past,
  by: "craftsman",
});

const workProposal = (status: BookingData["status"]): BookingData => ({
  kind: "work",
  date: "събота, 21 ноември",
  weekday: "събота",
  time: "09:00–13:00",
  iso: "2026-11-21",
  status,
  past: false,
  by: "craftsman",
});

const history = (past: boolean): Msg[] => [
  { t: "day", id: "d1", label: "вторник, 17 ноември" },
  {
    t: "text",
    id: "m1",
    from: "client",
    time: "10:12",
    state: "sent",
    label: "четвъртък, 19 ноември, сутрин (до 12 ч.)",
    body: "Здравейте! В хола две от лампите на тавана мигат, а третата не светва изобщо. Апартаментът е в Лозенец. Удобно ли ви е в четвъртък сутринта?",
  },
  { t: "text", id: "m2", from: "client", time: "10:14", state: "sent", photos: PHOTOS, body: "Ето как изглеждат лампите." },
  {
    t: "text",
    id: "m3",
    from: "craftsman",
    time: "11:02",
    state: "sent",
    body: "Добър ден! Най-вероятно е стартер или разхлабен контакт. Мога да мина на оглед в четвъртък между 9 и 11 ч.",
  },
  { t: "booking", id: "b1", from: "craftsman", time: "11:04", b: inspection(past) },
];

const ack = (time: string): Msg => ({
  t: "text",
  id: "m4",
  from: "client",
  time,
  state: "sent",
  body: "Добре, ще ви чакам в четвъртък. Входът е от задната страна.",
});

export function buildMessages(s: Scenario): Msg[] {
  if (s === 1) {
    return [
      ...history(false),
      { t: "day", id: "d2", label: "днес" },
      { t: "booking", id: "b2", from: "craftsman", time: "09:40", b: workProposal("proposed") },
      ack("09:55"),
      { t: "text", id: "m5", from: "craftsman", time: "10:05", state: "failed", body: "Ако искате, ще донеса и стартери за всеки случай." },
      { t: "text", id: "m6", from: "craftsman", time: "10:06", state: "sending", body: "До утре в 9 ч. Ще ви звънна от входа." },
    ];
  }
  return [
    ...history(true),
    ack("12:30"),
    { t: "day", id: "d2", label: "сряда, 18 ноември" },
    { t: "booking", id: "b2", from: "craftsman", time: "17:20", b: workProposal("declined") },
    { t: "day", id: "d3", label: "днес" },
    { t: "offer", id: "o1", time: "09:15", title: "Смяна на 3 осветителни тела, материалите отделно", total: 75 },
    { t: "text", id: "m7", from: "client", time: "09:42", state: "sent", body: "Благодаря! Ще помисля и ще ви пиша до утре." },
  ];
}
