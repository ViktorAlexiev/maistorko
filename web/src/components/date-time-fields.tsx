"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

/**
 * Date and time fields that look the same on every computer. The browser's own `type="date"` and `type="time"`
 * follow the computer's language (so some people see AM/PM and mm/dd/yyyy). These show дд/мм/гггг and 24-hour time.
 * Values stay in the usual machine form: "YYYY-MM-DD" and "HH:MM".
 */

const ISO = /^\d{4}-\d{2}-\d{2}$/;

const toDisplay = (iso: string) => (ISO.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

function fromDisplay(text: string): string | null {
  const m = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const dt = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  if (dt.getUTCFullYear() !== Number(y) || dt.getUTCMonth() !== Number(mo) - 1 || dt.getUTCDate() !== Number(d)) return null;
  return `${y}-${mo}-${d}`;
}

/** Keeps only digits and puts the slashes in: "2512" becomes "25/12" */
function mask(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
}

type DateProps = {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  /** adds a hidden input with the ISO value, for forms that submit with FormData */
  name?: string;
  placeholder?: string;
};

export function DateField({ id, value, onChange, min, max, className = "field", disabled, required, invalid, ariaLabel, name, placeholder = "дд/мм/гггг" }: DateProps) {
  const [text, setText] = useState(toDisplay(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    // the value was changed from outside (a preset button, a reset): show it
    setPrev(value);
    if (fromDisplay(text) !== value) setText(toDisplay(value));
  }
  const picker = useRef<HTMLInputElement>(null);
  const typed = fromDisplay(text);
  const outOfRange = Boolean(typed && ((min && typed < min) || (max && typed > max)));

  function type(raw: string) {
    const masked = mask(raw);
    setText(masked);
    const iso = fromDisplay(masked);
    if (masked === "") onChange("");
    else if (iso && !(min && iso < min) && !(max && iso > max)) onChange(iso);
  }

  return (
    <div className="relative">
      {name && <input type="hidden" name={name} value={value} />}
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        maxLength={10}
        className={`${className} pr-10`}
        value={text}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel}
        aria-invalid={invalid || outOfRange || (text.length === 10 && !typed) || undefined}
        onChange={(e) => type(e.target.value)}
        onBlur={() => {
          // a half-typed date goes back to the last good one
          if (!fromDisplay(text) && text !== "") setText(toDisplay(value));
          else if (outOfRange) setText(toDisplay(value));
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ink-2 hover:text-ink disabled:opacity-40"
        aria-label="Избери от календар"
        onClick={() => picker.current?.showPicker?.()}
      >
        <CalendarDays className="size-4" aria-hidden />
      </button>
      {/* the browser's picker only opens from the button; its text is never shown */}
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0"
        min={min}
        max={max}
        value={ISO.test(value) ? value : ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

type TimeProps = {
  id?: string;
  value: string;
  onChange: (hhmm: string) => void;
  /** minutes between the choices */
  step?: number;
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

export function TimeField({ id, value, onChange, step = 15, className = "field", disabled, invalid, ariaLabel }: TimeProps) {
  const m = value.match(/^(\d{2}):(\d{2})/);
  const hh = m ? m[1] : "";
  const mm = m ? m[2] : "";
  const minutes = Array.from({ length: Math.ceil(60 / step) }, (_, i) => pad(i * step));
  // a time that is not on the grid (say 09:20 saved earlier) stays selectable
  if (mm && !minutes.includes(mm)) minutes.push(mm);
  minutes.sort();

  return (
    <div className="flex items-center gap-1" role="group" aria-label={ariaLabel}>
      <select
        id={id}
        className={`${className} min-w-0 px-2`}
        value={hh}
        disabled={disabled}
        aria-invalid={invalid}
        aria-label={ariaLabel ? `${ariaLabel}, час` : "Час"}
        onChange={(e) => onChange(e.target.value ? `${e.target.value}:${mm || "00"}` : "")}
      >
        <option value="">--</option>
        {Array.from({ length: 24 }, (_, i) => pad(i)).map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span aria-hidden className="font-bold">
        :
      </span>
      <select
        className={`${className} min-w-0 px-2`}
        value={mm}
        disabled={disabled || !hh}
        aria-invalid={invalid}
        aria-label={ariaLabel ? `${ariaLabel}, минути` : "Минути"}
        onChange={(e) => hh && onChange(`${hh}:${e.target.value || "00"}`)}
      >
        {!mm && <option value="">--</option>}
        {minutes.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </select>
    </div>
  );
}
