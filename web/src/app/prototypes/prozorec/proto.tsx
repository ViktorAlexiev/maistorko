"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Star } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { formatEur } from "@/lib/format";
import { ProtoHarness } from "../_harness/picker";
import { CRAFTSMAN, DEMO_SENT, SCENARIOS, type Scenario, type SentData } from "./data";
import { useFirst } from "./first";
import { DnesWindow } from "./today";
import { KatoRazgovor } from "./variant-kato";
import { ChatWindow, Conversation } from "./window";

/** The switch over the window's conversation (s=3 and s=4): how it looks today, and in „Тихо“. */
const NAMES = ["Днес", "Тихо"];

const PRICES: [string, number][] = [
  ["Смяна на смесител", 60],
  ["Смяна на сифон", 35],
  ["Отпушване на канал", 70],
  ["Монтаж на бойлер", 90],
];

/** A static, plain copy of the top of the craftsman's public profile behind the window. */
function Profile({ onWrite, open }: { onWrite: () => void; open: boolean }) {
  return (
    <main className="fixed inset-0 z-40 overflow-hidden bg-paper">
      <div className="mx-auto max-w-3xl px-6 pt-16 sm:pt-20">
        <div className="flex items-center gap-5">
          <Avatar name={CRAFTSMAN.name} size={96} />
          <div className="min-w-0">
            <h1 className="display text-4xl sm:text-5xl">{CRAFTSMAN.name}</h1>
            <p className="mt-1 font-semibold text-ink-2">
              {CRAFTSMAN.category} · {CRAFTSMAN.place}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
              <Star className="size-4 fill-rule text-ink" aria-hidden />
              <span className="numerals text-lg">4,9</span>
              <span className="text-ink-2">· 37 отзива</span>
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-primary mt-6" onClick={onWrite} aria-expanded={open} aria-haspopup="dialog">
          <MessageSquare className="size-4" aria-hidden />
          Пиши
        </button>
        <p className="mt-8 max-w-xl text-ink-2">
          Правя ВиК ремонти в апартаменти и къщи в София вече 12 години: течове, смяна на смесители и сифони, бойлери, запушени канали. Идвам с нужните части и оставям чисто.
        </p>
        <h2 className="mt-8 text-lg font-extrabold">Цени</h2>
        <ul className="mt-2 grid max-w-xl gap-1.5">
          {PRICES.map(([name, price]) => (
            <li key={name} className="flex items-baseline justify-between gap-4 rounded-[6px] bg-surface px-3 py-2.5">
              <span>{name}</span>
              <span className="numerals text-xl">от {formatEur(price)}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

/** One session: a new one starts when the view or the scenario changes. `today` = the conversation drawn the way the window draws it today. */
function Session({ today, scenario }: { today: boolean; scenario: Scenario }) {
  const [open, setOpen] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  /** the first message once it has been sent; from then on the window shows the conversation */
  const [sent, setSent] = useState<SentData | null>(scenario >= 3 ? DEMO_SENT : null);
  const f = useFirst(scenario, setSent);

  // The page itself never scrolls: the profile and the window are fixed
  useEffect(() => {
    const els = [document.documentElement, document.body];
    const before = els.map((el) => el.style.overflow);
    els.forEach((el) => (el.style.overflow = "hidden"));
    return () => els.forEach((el, i) => (el.style.overflow = before[i]));
  }, []);

  const toggle = () => setCollapsed((v) => !v);
  const close = () => setOpen(false);

  return (
    <>
      <Profile
        open={open}
        onWrite={() => {
          setOpen(true);
          setCollapsed(false);
        }}
      />
      {today && sent ? (
        <DnesWindow open={open} collapsed={collapsed} onToggle={toggle} onClose={close} sent={sent} extended={scenario === 4} />
      ) : (
        <ChatWindow open={open} collapsed={collapsed} onToggle={toggle} line={sent ? "Разговор" : "Ново съобщение"} link={Boolean(sent)} onClose={close}>
          {sent ? <Conversation sent={sent} extended={scenario === 4} /> : <KatoRazgovor f={f} />}
        </ChatWindow>
      )}
    </>
  );
}

/** The scenario switch: a small harness pill at the top left, like the one of the conversation prototype. */
function ScenarioPill({ value, onChange }: { value: Scenario; onChange: (s: Scenario) => void }) {
  const [open, setOpen] = useState(false);
  const current = SCENARIOS[value - 1];
  return (
    <nav className="proto-picker proto-pill" aria-label="Prototype scenarios">
      <button type="button" className="proto-picker-item" data-active="" aria-expanded={open} aria-controls="proto-scenarios" onClick={() => setOpen((v) => !v)} style={{ justifyContent: "center", gap: 6 }}>
        {open ? "Сценарий ▴" : `Сц. ${value} ▾`}
      </button>
      {open && (
        <ul id="proto-scenarios" style={{ display: "grid", gap: 2, listStyle: "none", margin: 0, padding: 0 }}>
          {SCENARIOS.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="proto-picker-item"
                data-active={s.id === value ? "" : undefined}
                aria-current={s.id === value ? "true" : undefined}
                style={{ width: "100%", whiteSpace: "nowrap", background: s.id === value ? "rgba(255,255,255,0.12)" : undefined }}
                onClick={() => {
                  onChange(s.id);
                  setOpen(false);
                }}
              >
                {s.id} · {s.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <span className="sr-only">Сега: {current.label}</span>
    </nav>
  );
}

export function ProzorecProto({ initialVariant, initialScenario }: { initialVariant: number; initialScenario: Scenario }) {
  const [scenario, setScenario] = useState<Scenario>(initialScenario);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("s", String(scenario));
    // the switch exists only in s=3 and s=4; elsewhere v means nothing
    if (scenario < 3) url.searchParams.delete("v");
    window.history.replaceState(null, "", url);
  }, [scenario]);

  return (
    <>
      {/* On a phone the window starts below a strip that holds the two harness pills, so they never cover its buttons */}
      <style>{`
        .proto-pill { top: 24px; bottom: auto; left: 8px; transform: none; flex-direction: column; align-items: stretch; border-radius: 18px; max-width: calc(100vw - 16px); }
        @media (max-width: 639px) {
          .proto-picker[data-position="top"] { top: 7px; left: auto; right: 8px; transform: none; }
          .proto-pill { top: 7px; }
          .proto-picker-item { padding: 0 9px; }
        }
      `}</style>
      {scenario >= 3 ? (
        <ProtoHarness key={scenario} names={NAMES} initial={initialVariant} position="top">
          {(i) => <Session key={`${i}-${scenario}`} today={i === 0} scenario={scenario} />}
        </ProtoHarness>
      ) : (
        <Session key={scenario} today={false} scenario={scenario} />
      )}
      <ScenarioPill value={scenario} onChange={setScenario} />
    </>
  );
}
