"use client";

import { useEffect, useState } from "react";
import { FormSide, type City, type Screen } from "./shared";
import { VariantMetar } from "./variant-metar";
import "../tablo-nav/proto.css";

export function Proto({ screen, cities, today }: { screen: Screen; cities: City[]; today: string }) {
  // nonce remounts the registration form when the screen is changed from outside the form
  const [state, setState] = useState({ screen, nonce: 0 });
  const go = (next: Screen, remount: boolean) =>
    setState((p) => (p.screen === next ? p : { screen: next, nonce: remount ? p.nonce + 1 : p.nonce }));

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("s", state.screen);
    window.history.replaceState(null, "", url);
  }, [state.screen]);

  return (
    <div
      className="proto-nolines"
      // the role choice inside the real registration form moves the title and the side column with it
      onChangeCapture={(e) => {
        const t = e.target as HTMLInputElement;
        if (t.name === "role") go(t.value === "craftsman" ? "maistor" : "klient", false);
      }}
      // links between login and registration stay inside the prototype
      onClickCapture={(e) => {
        const a = (e.target as HTMLElement).closest("a");
        if (!a) return;
        const url = new URL(a.href, window.location.href);
        if (url.pathname !== "/registratsia" && url.pathname !== "/vhod") return;
        e.preventDefault();
        go(url.pathname === "/vhod" ? "vhod" : url.searchParams.get("rolya") === "maistor" ? "maistor" : "klient", true);
        window.scrollTo(0, 0);
      }}
    >
      <VariantMetar
        screen={state.screen}
        today={today}
        form={<FormSide screen={state.screen} nonce={state.nonce} cities={cities} />}
      />
    </div>
  );
}
