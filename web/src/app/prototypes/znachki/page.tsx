import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ZnachkiProto } from "./proto";

export const metadata: Metadata = { title: "Проба: значките горе", robots: { index: false } };

/**
 * Planning prototype for the marks in the site header („Съобщения“ and the bell): four variants
 * (Като в профила, Нит, Ореол, Изрез: the dot on „Съобщения“, the bell is always the red count), four states. All state local, nothing saved. Not reachable in production.
 * ?v=1|2|3|4 picks the variant, ?s=1|2|3|4 the state.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ v?: string; s?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const pick = (x: string | undefined, max: number) => Math.min(Math.max(Number.parseInt(x ?? "1", 10) || 1, 1), max);
  return <ZnachkiProto initialVariant={pick(sp.v, 4) - 1} initialState={pick(sp.s, 4)} />;
}
