"use client";

import { useEffect, useRef, useState } from "react";
import { ProtoHarness } from "../_harness/picker";
import { Home } from "../razgovor/home";
import { useRoom } from "../razgovor/shared";
import { SheetRows } from "../razgovor/variant-sheet";
import { SiteHeaderCopy, type Variant } from "./header";

const NAMES = ["Като в профила", "Нит", "Ореол", "Изрез"];

/** The four states: how many unread messages and how many unread notifications. */
const STATES = [
  { id: 1, label: "Нищо ново", messages: 0, bell: 0 },
  { id: 2, label: "1 съобщение, 2 известия", messages: 1, bell: 2 },
  { id: 3, label: "12 съобщения, 5 известия", messages: 12, bell: 5 },
  { id: 4, label: "120 съобщения, 130 известия", messages: 120, bell: 130 },
];

/** One session: the header copy over the approved „Преглед“ page. A new one starts when the variant or the state changes. */
function Session({ variant, state, extra }: { variant: Variant; state: number; extra: number }) {
  const box = useRef<HTMLTextAreaElement>(null);
  const room = useRoom(5, box);
  const st = STATES[state - 1];
  // Nothing leaves this prototype: rows and the menu only show the „Проба“ line, and the page's own unread mark follows the state
  const r = {
    ...room,
    rows: st.messages === 0 ? room.rows.map((x) => ({ ...x, unread: false })) : room.rows,
    unreadCount: st.messages === 0 ? 0 : room.unreadCount,
    open: () => room.flash("Проба: тук се отварят съобщенията."),
    goMessages: () => room.flash("Проба: тук се отварят съобщенията."),
  };
  return (
    <>
      <Home r={r} Rows={SheetRows} />
      <SiteHeaderCopy variant={variant} messages={st.messages + extra} bell={st.bell} flash={room.flash} />
    </>
  );
}

/** The state switch: a small harness pill at the top left, like the scenario pill of the conversation prototype. */
function StatePill({ value, onChange, onNew }: { value: number; onChange: (s: number) => void; onNew: () => void }) {
  const [open, setOpen] = useState(false);
  const current = STATES[value - 1];
  return (
    <nav
      className="proto-picker"
      aria-label="Prototype states"
      style={{ top: 24, bottom: "auto", left: 8, transform: "none", flexDirection: "column", alignItems: "stretch", borderRadius: 18, maxWidth: "calc(100vw - 16px)" }}
    >
      <button
        type="button"
        className="proto-picker-item"
        data-active=""
        aria-expanded={open}
        aria-controls="proto-states"
        onClick={() => setOpen((v) => !v)}
        style={{ justifyContent: "center", gap: 6 }}
      >
        {open ? "Състояние ▴" : `Сц. ${value} ▾`}
      </button>
      {open && (
        <ul id="proto-states" style={{ display: "grid", gap: 2, listStyle: "none", margin: 0, padding: 0 }}>
          {STATES.map((s) => (
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
      <button type="button" className="proto-picker-item" onClick={onNew} style={{ justifyContent: "center", whiteSpace: "nowrap" }}>
        Ново съобщение
      </button>
      <span className="sr-only">Сега: {current.label}</span>
    </nav>
  );
}

export function ZnachkiProto({ initialVariant, initialState }: { initialVariant: number; initialState: number }) {
  const [state, setState] = useState(initialState);
  /** unread messages added with „Ново съобщение“; they start over with a new state */
  const [extra, setExtra] = useState(0);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("s", String(state));
    window.history.replaceState(null, "", url);
  }, [state]);

  return (
    <>
      {/* On a phone the variant switch sits just above the bottom bar, so it covers neither the header marks nor the bell dropdown */}
      <style>{`@media (max-width: 767px) { .proto-picker[data-position="top"] { top: auto; bottom: 60px; } }`}</style>
      <ProtoHarness names={NAMES} initial={initialVariant} position="top">
        {(i) => <Session key={`${i}-${state}`} variant={(i + 1) as Variant} state={state} extra={extra} />}
      </ProtoHarness>
      <StatePill
        value={state}
        onChange={(s) => {
          setState(s);
          setExtra(0);
        }}
        onNew={() => setExtra((n) => n + 1)}
      />
    </>
  );
}
