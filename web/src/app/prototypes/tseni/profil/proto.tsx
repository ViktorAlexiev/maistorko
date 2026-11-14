"use client";

import Link from "next/link";
import { Clock, Languages, MapPin, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Rating, VerifiedBadge } from "@/components/bits";
import { PERSON, profileData } from "./profil-data";
import { VariantKutii } from "./variants";

/**
 * The public profile around the approved „Кутии“ „Цени“ section, as on /maistori/[slug] (header, side card, phone
 * action bar). The calendar above „Цени“ on the real page is left out.
 */
export function ProfilProto({ two }: { two: boolean }) {
  const d = profileData(two);
  const subs = d.groups.flatMap((g) => g.boxes.map((b) => b.name));
  const real = `/maistori/${PERSON.slug}`;
  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
      <nav aria-label="Път" className="mb-5 text-sm text-ink-3">
        <Link href="/maistori" className="link">
          Майстори
        </Link>
        {" / "}
        <Link href="/kategorii/elektrouslugi" className="link">
          Електроуслуги
        </Link>
      </nav>

      <header className="grid gap-6 border-b border-ink pb-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="flex gap-4 sm:gap-6">
          <Avatar name={PERSON.name} url={null} size={112} square className="max-sm:!size-20 max-sm:!text-3xl" />
          <div className="min-w-0">
            <h1 className="display flex flex-wrap items-center gap-x-3 text-5xl sm:text-6xl">
              {PERSON.name}
              <span className="text-3xl">
                <VerifiedBadge />
              </span>
            </h1>
            <p className="mt-2 text-lg">{d.groups.map((g) => g.name).join(" · ")}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden /> {PERSON.city}
              </span>
              <Rating avg={PERSON.rating} count={PERSON.ratingCount} />
              <span>{PERSON.years} години опит</span>
              <VerifiedBadge withLabel />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:items-end">
          <p className="numerals text-6xl leading-none sm:text-7xl lg:text-[5.5rem]">{d.headline}</p>
          <div className="hidden gap-2 lg:flex">
            <Link href={real} className="btn btn-primary">
              <MessageCircle className="size-4" aria-hidden /> Пиши на {PERSON.firstName}
            </Link>
          </div>
        </div>
      </header>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-14">
        <div className="grid min-w-0 gap-14">
          <VariantKutii d={d} />

          <section aria-labelledby="about-heading">
            <h2 id="about-heading" className="display text-4xl">
              За {PERSON.firstName}
            </h2>
            <p className="mt-3 max-w-[68ch] whitespace-pre-line text-lg leading-relaxed">{PERSON.bio}</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {subs.map((s) => (
                <li key={s} className="rounded-full bg-surface px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ring-line">
                  {s}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="order-first lg:order-none">
          <div className="grid gap-5 rounded-[10px] border border-line bg-surface p-5 lg:sticky lg:top-24">
            <section aria-labelledby="contacts-heading" className="grid gap-3 border-b border-line pb-5">
              <h2 id="contacts-heading" className="text-lg font-extrabold">
                Контакти
              </h2>
              <Link href={real} className="btn btn-primary w-full">
                <MessageCircle className="size-4" aria-hidden /> Пиши на {PERSON.firstName}
              </Link>
              <p className="flex gap-2 text-[0.95rem] font-semibold">
                <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                Обикновено отговаря до 2 часа
              </p>
            </section>
            <dl className="grid gap-4 text-[0.95rem]">
              <div>
                <dt className="font-bold">Работи в</dt>
                <dd className="mt-1 text-ink-2">{PERSON.city}</dd>
              </div>
              <div className="flex gap-2">
                <Languages className="mt-0.5 size-4 shrink-0" aria-hidden />
                <div>
                  <dt className="sr-only">Езици</dt>
                  <dd>Български</dd>
                </div>
              </div>
            </dl>
          </div>
        </aside>
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 px-4 pt-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="numerals truncate text-2xl leading-none">{d.headline}</p>
            <p className="truncate text-sm text-ink-3">{PERSON.name}</p>
          </div>
          <Link href={real} className="btn btn-primary">
            Пиши
          </Link>
        </div>
      </div>
    </div>
  );
}
