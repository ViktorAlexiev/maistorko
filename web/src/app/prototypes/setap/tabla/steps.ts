/** Prototype data for „Първи стъпки“: the five steps and what the craftsman has done in each demo state. */

export type DemoState = "nov" | "chast" | "vidim";
export type StepKey = "kakvo" | "tseni" | "koga" | "za-men" | "snimki";

export type Step = {
  key: StepKey;
  /** The step's name in today's block (the meter shows `short`) */
  label: string;
  /** One word on the meter's part */
  short: string;
  /** How the step is named after „Липсва:“ (only the three the search needs) */
  missing?: string;
  /** Needed for the profile to show in search */
  required: boolean;
  done: boolean;
  href: string;
};

const DONE: Record<DemoState, StepKey[]> = {
  nov: [],
  chast: ["kakvo", "koga"],
  vidim: ["kakvo", "tseni", "koga"],
};

/** Where each setup step opens in the prototype; the demo param makes the setup start with what this state has saved. */
const SETUP_DEMO: Record<DemoState, string> = {
  nov: "",
  chast: "&demo=part",
  vidim: "&demo=ready",
};

export function stepsFor(state: DemoState): Step[] {
  const done = new Set(DONE[state]);
  const setup = (n: number) =>
    `/prototypes/setap?stapka=${n}${SETUP_DEMO[state]}`;
  return [
    {
      key: "kakvo",
      label: "Избери какво работиш",
      short: "Работа",
      missing: "какво работиш",
      required: true,
      done: done.has("kakvo"),
      href: setup(1),
    },
    {
      key: "tseni",
      label: "Добави цени",
      short: "Цени",
      missing: "цени",
      required: true,
      done: done.has("tseni"),
      href: setup(3),
    },
    {
      key: "koga",
      label: "Отбележи кога си свободен",
      short: "График",
      missing: "кога си свободен",
      required: true,
      done: done.has("koga"),
      href: setup(4),
    },
    {
      key: "za-men",
      label: "Напиши няколко изречения за себе си",
      short: "За теб",
      required: false,
      done: false,
      href: "/tabla/profil?chast=za-men",
    },
    {
      key: "snimki",
      label: "Качи снимки от работа",
      short: "Снимки",
      required: false,
      done: false,
      href: "/tabla/snimki",
    },
  ];
}

/** „цени“, „цени и кога си свободен“, „какво работиш, цени и кога си свободен“ */
export function joinMissing(steps: Step[]): string {
  const m = steps.filter((s) => s.required && !s.done).map((s) => s.missing!);
  return m.length <= 1
    ? (m[0] ?? "")
    : `${m.slice(0, -1).join(", ")} и ${m[m.length - 1]}`;
}

/** Fourteen days from today: weekdays free when the schedule step is done, else all busy. */
export function demoStrip(state: DemoState): string {
  const scheduled = DONE[state].includes("koga");
  const d = new Date();
  let s = "";
  for (let i = 0; i < 14; i++) {
    const wd = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate() + i,
    ).getDay();
    s += scheduled && wd >= 1 && wd <= 5 ? "F" : "B";
  }
  return s;
}
