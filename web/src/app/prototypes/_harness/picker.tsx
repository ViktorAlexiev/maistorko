"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./picker.css";

/**
 * Prototype harness: shows one variant at a time behind the fixed picker.
 * Keys 1–N and ←/→ switch; the choice persists in ?v=. Planning only, never imported by product code.
 */
export function ProtoHarness({
  names,
  initial,
  position = "bottom",
  children,
}: {
  names: string[];
  initial: number;
  /** "top" when the piece itself sits at the bottom centre of the screen */
  position?: "bottom" | "top" | "top-on-phone";
  children: (index: number) => React.ReactNode;
}) {
  const [current, setCurrent] = useState(Math.min(Math.max(initial, 0), names.length - 1));
  const [top, setTop] = useState(position === "top");
  const navRef = useRef<HTMLElement>(null);
  const hiRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useLayoutEffect(() => {
    const move = () => {
      const el = itemRefs.current[current];
      if (!el || !hiRef.current) return;
      hiRef.current.style.width = `${el.offsetWidth}px`;
      hiRef.current.style.transform = `translateX(${el.offsetLeft}px)`;
    };
    move();
    window.addEventListener("resize", move);
    return () => window.removeEventListener("resize", move);
  }, [current, top]);

  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(current + 1));
    window.history.replaceState(null, "", url);
  }, [current]);

  useEffect(() => {
    // Enable the slide only after first paint, so load doesn't animate.
    const id = requestAnimationFrame(() => requestAnimationFrame(() => navRef.current?.setAttribute("data-ready", "")));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (position !== "top-on-phone") return;
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setTop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [position]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= names.length) setCurrent(num - 1);
      else if (e.key === "ArrowRight") setCurrent((c) => (c + 1) % names.length);
      else if (e.key === "ArrowLeft") setCurrent((c) => (c - 1 + names.length) % names.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [names.length]);

  return (
    <>
      <div key={current}>{children(current)}</div>
      <nav ref={navRef} className="proto-picker" aria-label="Prototype variants" data-position={top ? "top" : undefined}>
        <span ref={hiRef} className="proto-picker-highlight" aria-hidden="true" />
        {names.map((name, i) => (
          <button
            key={name}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            type="button"
            className="proto-picker-item"
            data-active={i === current ? "" : undefined}
            aria-current={i === current ? "true" : undefined}
            onClick={() => setCurrent(i)}
          >
            {name}
          </button>
        ))}
      </nav>
    </>
  );
}
