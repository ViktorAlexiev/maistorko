"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "../_harness/picker.css";
import { SCENARIOS, type Scenario } from "./data";
import { useRoom } from "./shared";
import { Home } from "./home";
import { SheetRows, VariantSheet } from "./variant-sheet";

/** One conversation session: a new one starts when the scenario changes. */
function Session({ scenario }: { scenario: Scenario }) {
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const r = useRoom(scenario, box);
  // New things always land at the bottom of the thread
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [r.activeId, r.messages.length, r.askStep, r.rate.open, r.rate.done]);
  // „Преглед“ (s=5, s=6): the dashboard home with the same rows as the list
  if (r.view === "home") return <Home r={r} Rows={SheetRows} />;
  return <VariantSheet r={r} scroller={scroller} box={box} />;
}

/** The scenario switch: a second, small harness pill at the top left. Collapsed it is one word inside the site header; open it drops a short list. */
function ScenarioPill({ value, onChange }: { value: Scenario; onChange: (s: Scenario) => void }) {
  const [open, setOpen] = useState(false);
  const current = SCENARIOS[value - 1];
  return (
    <nav
      className="proto-picker"
      aria-label="Prototype scenarios"
      style={{ top: 24, bottom: "auto", left: 8, transform: "none", flexDirection: "column", alignItems: "stretch", borderRadius: 18, maxWidth: "calc(100vw - 16px)" }}
    >
      <button
        type="button"
        className="proto-picker-item"
        data-active=""
        aria-expanded={open}
        aria-controls="proto-scenarios"
        onClick={() => setOpen((v) => !v)}
        style={{ justifyContent: "center", gap: 6 }}
      >
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

export function RazgovorProto({ initialScenario }: { initialScenario: Scenario }) {
  const [scenario, setScenario] = useState<Scenario>(initialScenario);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("s", String(scenario));
    window.history.replaceState(null, "", url);
  }, [scenario]);

  return (
    <>
      <Session key={scenario} scenario={scenario} />
      <ScenarioPill value={scenario} onChange={setScenario} />
    </>
  );
}
