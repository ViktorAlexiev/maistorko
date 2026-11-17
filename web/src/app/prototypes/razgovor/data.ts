/** The conversations behind the three variants of „Разговорът“. Planning prototype: nothing here is saved. */

export type Scenario = 1 | 2 | 3 | 4 | 5 | 6;
export type Role = "craftsman" | "client";

export const SCENARIOS: { id: Scenario; label: string; viewer: Role }[] = [
  { id: 1, label: "Майстор · огледът е утре", viewer: "craftsman" },
  { id: 2, label: "Майстор · огледът мина", viewer: "craftsman" },
  { id: 3, label: "Клиент · огледът мина", viewer: "client" },
  { id: 4, label: "Няма избран разговор", viewer: "craftsman" },
  { id: 5, label: "Преглед · майстор", viewer: "craftsman" },
  { id: 6, label: "Преглед · клиент", viewer: "client" },
];

export const PEOPLE = {
  craftsman: { name: "Георги Петров", first: "Георги", phone: "+359 899 555 010" },
  client: { name: "Мария Иванова", first: "Мария", phone: "+359 888 123 456" },
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
  /** "утре" or "днес" when the day is close; otherwise the bar says „в <weekday>“ */
  rel?: string;
  /** sort key of the day */
  iso: string;
  status: "proposed" | "confirmed" | "declined" | "cancelled";
  past: boolean;
  /** who proposed it */
  by: Role;
};

/** What an offer really has (table `offers`): title, total, lines, status, valid_until, viewed_at. Statuses are the real ones. */
export type OfferData = {
  token: string;
  title: string;
  total: number;
  lines: { name: string; amount: number; kind: "service" | "material" }[];
  status: "sent" | "accepted" | "declined" | "expired";
  /** "5 декември" */
  validUntil: string;
  viewed: boolean;
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
  | { t: "offer"; id: string; time: string; o: OfferData }
  | { t: "invite"; id: string; time: string; body: string };

export type Thread = {
  id: string;
  name: string;
  phone: string;
  /** the line under the name: which day and which kind of work */
  about: string;
  /** time shown in the list */
  when: string;
  unread: boolean;
  messages: Msg[];
};

export const INVITE_BODY = "Работата е свършена. Ще се радвам на кратък отзив.";

export const QUICK_DEFAULTS = ["Идвам утре в 10", "Прати снимка на проблема", "Цената е от … до …", "Кога ти е удобно?"];
export const QUICK_OWN = [{ id: "own-1", body: "Благодаря, ще се чуем утре" }];

export const PHOTOS = ["/demo/work/lighting.svg", "/demo/work/electrical-panel.svg"];

/** The line under the name of the main conversation. */
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

export const OFFER: OfferData = {
  token: "5d2f7c1e-3a4b-4c8d-9e1f-6a7b8c9d0e1f",
  title: "Смяна на 3 осветителни тела",
  total: 75,
  lines: [
    { name: "Демонтаж на старите тела", amount: 25, kind: "service" },
    { name: "Монтаж на 3 нови тела", amount: 40, kind: "service" },
    { name: "Проверка на контактите и стартера", amount: 10, kind: "service" },
  ],
  status: "sent",
  validUntil: "5 декември",
  viewed: true,
};

function mainMessages(s: Scenario): Msg[] {
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
    { t: "offer", id: "o1", time: "09:15", o: OFFER },
    { t: "text", id: "m7", from: "client", time: "09:42", state: "sent", body: "Благодаря! Ще помисля и ще ви пиша до утре." },
  ];
}

const text = (id: string, from: Role, time: string, body: string): Msg => ({ t: "text", id, from, time, body, state: "sent" });

/** The list: the full conversation first, then three short ones. In s=3 the viewer is the client, so the rows are craftsmen. */
export function buildThreads(s: Scenario): Thread[] {
  if (s === 3) {
    return [
      { id: "georgi", name: PEOPLE.craftsman.name, phone: PEOPLE.craftsman.phone, about: aboutLine(s), when: "днес", unread: false, messages: mainMessages(s) },
      {
        id: "ivan",
        name: "Иван Димитров",
        phone: "+359 877 410 220",
        about: `Вчера · ВиК`,
        when: "вчера",
        unread: true,
        messages: [
          { t: "day", id: "i0", label: "вчера" },
          text("i1", "client", "16:10", "Под мивката в банята капе вода. Може ли да дойдете днес?"),
          text("i2", "craftsman", "16:32", "Може след 17 ч. Ще сменя сифона и уплътненията."),
          text("i3", "craftsman", "19:05", "Тръбата е сменена, ще ви пиша за сметката."),
        ],
      },
      {
        id: "nedyalko",
        name: "Недялко Стоянов",
        phone: "+359 878 330 145",
        about: "В понеделник · Боядисване",
        when: "пн",
        unread: false,
        messages: [
          { t: "day", id: "n0", label: "понеделник, 16 ноември" },
          text("n1", "client", "11:00", "Колко струва боядисването на стая от 14 кв.м?"),
          text("n2", "craftsman", "11:20", "Около 280 €, а с шпакловка 360 €. Цветът е ваш избор."),
          text("n3", "client", "11:25", "Удобно ми е в понеделник."),
        ],
      },
      {
        id: "rumen",
        name: "Румен Господинов",
        phone: "+359 879 120 874",
        about: "Миналата седмица · Плочки",
        when: "чт",
        unread: false,
        messages: [
          { t: "day", id: "r0", label: "четвъртък, 12 ноември" },
          text("r1", "craftsman", "15:40", "Плочките в банята са положени и фугирани."),
          text("r2", "client", "15:52", "Прекрасно, много ви благодаря!"),
          text("r3", "craftsman", "15:54", "Приятно ползване!"),
        ],
      },
    ];
  }
  const past = s !== 1;
  return [
    { id: "maria", name: PEOPLE.client.name, phone: PEOPLE.client.phone, about: aboutLine(s), when: "днес", unread: false, messages: mainMessages(s) },
    {
      id: "stoyan",
      name: "Стоян Колев",
      phone: "+359 887 640 312",
      about: "Във вторник · Контакти и ключове",
      when: "вчера",
      unread: true,
      messages: [
        { t: "day", id: "s0", label: "вчера" },
        text("s1", "client", "18:20", "Здравейте! Трябва ми нов контакт в кухнята и още един ключ за стълбището."),
        text("s2", "client", "18:21", "Може ли във вторник сутринта?"),
      ],
    },
    {
      id: "desislava",
      name: "Десислава Тодорова",
      phone: "+359 889 255 071",
      about: "В понеделник · Електрическо табло",
      when: "пн",
      unread: false,
      messages: [
        { t: "day", id: "t0", label: "понеделник, 16 ноември" },
        text("t1", "craftsman", "13:10", "Таблото е сменено и всичко е проверено. Ако нещо се появи, пишете."),
        {
          t: "booking",
          id: "tb1",
          from: "craftsman",
          time: "13:12",
          b: { kind: "work", date: "понеделник, 16 ноември", weekday: "понеделник", time: "08:00–12:00", iso: "2026-11-16", status: "confirmed", past: true, by: "craftsman" },
        },
        text("t2", "client", "18:30", "Благодаря, всичко работи."),
      ],
    },
    {
      id: "nikolay",
      name: "Николай Попов",
      phone: "+359 898 701 466",
      about: "В петък · Видеонаблюдение",
      when: "съб",
      unread: false,
      messages: [
        { t: "day", id: "k0", label: "събота, 14 ноември" },
        text("k1", "client", "09:30", "Искам да сложа 2 камери пред входа. Колко ще струва?"),
        text("k2", "craftsman", "10:05", "Цената е от 180 € с монтажа. Мога да огледам в петък."),
        text("k3", "client", "10:12", "Петък следобед става."),
        {
          t: "booking",
          id: "kb1",
          from: "craftsman",
          time: "10:15",
          b: { kind: "inspection", date: "петък, 20 ноември", weekday: "петък", time: "14:00–16:00", rel: past ? "днес" : undefined, iso: "2026-11-20", status: "confirmed", past: false, by: "craftsman" },
        },
        text("k4", "craftsman", "10:16", "Ще мина в петък следобед."),
      ],
    },
  ];
}
