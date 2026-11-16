import { notFound } from "next/navigation";
import CraftsmanPage from "@/app/maistori/[slug]/page";

export const metadata = { title: "Проба: профил на телефон", robots: { index: false } };

/**
 * Planning prototype for №2: on a phone the public profile shows „Кога е свободен“ before the „Контакти“ box.
 * The real profile page, unchanged; only a phone-width style moves the blocks. Desktop is as today.
 * Not reachable in production. ?m=<slug> picks the craftsman (default georgi-petrov).
 */
const CSS = `
@media (max-width: 1023.98px) {
  .proto-n2 .mt-10.grid > div:first-child { display: contents; }
  .proto-n2 .mt-10.grid > aside { order: 1 !important; }
  .proto-n2 #kalendar ~ * { order: 2; }
}`;

export default async function Page({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const slug = sp.m && /^[a-z0-9-]+$/.test(sp.m) ? sp.m : "georgi-petrov";
  return (
    <div className="proto-n2">
      <style>{CSS}</style>
      <CraftsmanPage params={Promise.resolve({ slug })} searchParams={Promise.resolve({})} />
    </div>
  );
}
