"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type Photo = { id: string; url: string; caption: string | null; demo: boolean };

export function Gallery({ photos, name }: { photos: Photo[]; name: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const open = (i: number) => {
    setIndex(i);
    dialog.current?.showModal();
  };
  const go = (d: number) => setIndex((i) => (i + d + photos.length) % photos.length);
  const current = photos[index];

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {photos.map((p, i) => (
          <li key={p.id} className={i === 0 && photos.length > 2 ? "col-span-2 row-span-2" : ""}>
            <button
              type="button"
              onClick={() => open(i)}
              className="group relative block aspect-[4/3] h-full w-full overflow-hidden rounded-[8px] bg-surface-2"
              aria-label={`Отвори снимка: ${p.caption ?? `работа на ${name}`}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={p.caption ?? `Работа на ${name}`}
                loading="lazy"
                className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
              {p.demo && (
                <span className="absolute left-2 top-2 rounded bg-ink/75 px-1.5 py-0.5 text-[0.7rem] font-bold text-white">
                  Демо изображение
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialog}
        className="m-auto max-h-[92dvh] w-[min(64rem,94vw)] overflow-hidden rounded-[12px] bg-graphite p-0 text-white backdrop:bg-ink/80"
        aria-label="Снимки"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
      >
        {current && (
          <figure className="on-dark relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.url} alt={current.caption ?? ""} className="max-h-[80dvh] w-full bg-black object-contain" />
            <figcaption className="flex items-center gap-3 px-4 py-3">
              <span className="numerals text-lg text-rule">
                {index + 1}/{photos.length}
              </span>
              <span className="flex-1">{current.caption}</span>
              {photos.length > 1 && (
                <>
                  <button type="button" className="btn btn-sm text-white hover:bg-white/10" onClick={() => go(-1)} aria-label="Предишна">
                    <ChevronLeft className="size-5" aria-hidden />
                  </button>
                  <button type="button" className="btn btn-sm text-white hover:bg-white/10" onClick={() => go(1)} aria-label="Следваща">
                    <ChevronRight className="size-5" aria-hidden />
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn btn-sm text-white hover:bg-white/10"
                onClick={() => dialog.current?.close()}
                aria-label="Затвори"
              >
                <X className="size-5" aria-hidden />
              </button>
            </figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}
