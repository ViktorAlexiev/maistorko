"use client";

import { useState } from "react";
import { addDaysISO, isoWeekday, MONTHS, parseISO, WEEKDAYS, WEEKDAYS_SHORT } from "@/lib/format";

export type AuthScreen = "vhod" | "klient" | "maistor";

type Status = "F" | "P" | "B";

const EXAMPLE = "FBFFPFBFFBBFPF";
const WORD: Record<Status, string> = { F: "свободен", P: "свободен отчасти", B: "зает" };
const AFTER: Record<Status, string> = {
  F: "Пишеш му и се разбирате за часа.",
  P: "Има свободни часове, питаш го в чата.",
  B: "Гледаш друг ден или друг майстор.",
};

const COPY: Record<AuthScreen, { head: string; text: string }> = {
  vhod: { head: "Добре дошли отново.", text: "Съобщенията ви чакат там, където ги оставихте." },
  klient: {
    head: "Избери ден и виж кой е свободен.",
    text: "Всеки майстор носи такъв метър за следващите 14 дни. Докосни ден от него.",
  },
  maistor: {
    head: "Това ще е твоят метър.",
    text: "Докосни ден, за да го направиш зает или свободен. След регистрацията го нагласяш наистина.",
  },
};

function dayName(iso: string) {
  const d = parseISO(iso);
  const w = WEEKDAYS[isoWeekday(iso) - 1];
  return `${w[0].toUpperCase()}${w.slice(1)}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** The big folding rule beside the auth forms: the yellow is the rule itself, two weeks folded in two, with the real dates. */
export function AuthMeter({ screen, today }: { screen: AuthScreen; today: string }) {
  return <Field key={screen} screen={screen} today={today} />;
}

function Field({ screen, today }: { screen: AuthScreen; today: string }) {
  const [strip, setStrip] = useState(() =>
    screen === "maistor"
      ? Array.from({ length: 14 }, (_, i) => (isoWeekday(addDaysISO(today, i)) >= 6 ? "B" : "F")).join("")
      : EXAMPLE,
  );
  const [picked, setPicked] = useState<number | null>(null);
  const days = strip.split("").map((s, i) => ({ iso: addDaysISO(today, i), status: s as Status }));
  const free = days.filter((d) => d.status !== "B").length;

  const onPick = (i: number) => {
    if (screen === "maistor") setStrip((s) => s.slice(0, i) + (s[i] === "B" ? "F" : "B") + s.slice(i + 1));
    else setPicked(i);
  };

  return (
    <>
      <h2 className="display text-balance text-4xl sm:text-5xl">{COPY[screen].head}</h2>
      <p className="mt-3 max-w-[46ch] text-lg text-ink-2">{COPY[screen].text}</p>

      <div role="group" aria-label="Метър за следващите 14 дни" className="relative mt-7 grid gap-1.5">
        {[days.slice(0, 7), days.slice(7)].map((week, wi) => (
          <div key={wi} className="grid h-[6.25rem] grid-cols-7 rounded-[6px] bg-rule sm:h-[9.25rem]">
            {week.map((d, di) => {
              const i = wi * 7 + di;
              const weekday = isoWeekday(d.iso);
              const label = `${dayName(d.iso)}: ${WORD[d.status]}`;
              const inner = (
                <>
                  {di > 0 && <span aria-hidden className="absolute left-0 top-0 h-[26%] w-px bg-ink" />}
                  <span aria-hidden className="absolute left-1/2 top-0 h-[13%] w-px bg-ink/70" />
                  <span
                    aria-hidden
                    className={`numerals mt-7 text-[2.1rem] leading-none sm:mt-11 sm:text-[3.5rem] ${i === 0 ? "text-red" : ""}`}
                  >
                    {parseISO(d.iso).getUTCDate()}
                  </span>
                  <span
                    aria-hidden
                    className={`mt-0.5 text-[0.68rem] font-bold uppercase leading-none sm:text-[0.8rem] ${weekday >= 6 ? "text-ink/65" : ""}`}
                  >
                    {WEEKDAYS_SHORT[weekday - 1]}
                  </span>
                  <span
                    aria-hidden
                    className={`absolute inset-x-1 bottom-1 h-2 origin-left rounded-[2px] transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none sm:inset-x-1.5 sm:bottom-1.5 sm:h-3 ${
                      d.status === "P" ? "hatch" : "bg-free"
                    } ${d.status === "B" ? "scale-x-0 opacity-0" : ""}`}
                  />
                  {picked === i && <span aria-hidden className="absolute inset-0 rounded-[5px] ring-[3px] ring-inset ring-red" />}
                </>
              );
              const base = "relative flex flex-col items-center";
              return (
                <button
                  key={d.iso}
                  type="button"
                  aria-label={label}
                  aria-pressed={screen === "maistor" ? d.status !== "B" : picked === i}
                  onClick={() => onPick(i)}
                  className={`${base} cursor-pointer rounded-[5px] transition-colors hover:bg-ink/[0.07] active:bg-ink/[0.13] focus-visible:z-10 focus-visible:outline-offset-[-3px]`}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        ))}
        {/* the hinge: one brass rivet holds the two folded weeks at their end */}
        <span
          aria-hidden
          className="absolute right-0 top-1/2 size-3.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-brass shadow-[inset_0_0_0_1.5px_rgb(22_20_15/0.75)]"
        />
      </div>

      <p aria-live="polite" className="mt-4 min-h-[3.5rem] text-lg">
        {screen === "maistor" ? (
          <>
            Свободен си в <span className="numerals text-[1.7rem] leading-none">{free}</span> от следващите 14 дни. Това
            виждат клиентите.
          </>
        ) : picked === null ? (
          <span className="text-ink-2">Още не си избрал ден.</span>
        ) : (
          <>
            <strong className="font-extrabold">{dayName(days[picked].iso)}:</strong> {WORD[days[picked].status]}.{" "}
            {AFTER[days[picked].status]}
          </>
        )}
      </p>

      <ul className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-5 rounded-[2px] bg-free" /> свободен
        </li>
        {screen !== "maistor" && (
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="hatch h-2.5 w-5 rounded-[2px]" /> отчасти
          </li>
        )}
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-5 rounded-[2px] bg-rule" /> зает
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="numerals text-base leading-none text-red">
            {parseISO(today).getUTCDate()}
          </span>{" "}
          днес
        </li>
        {screen !== "maistor" && <li>Това е пример, не истински майстор.</li>}
      </ul>
    </>
  );
}
