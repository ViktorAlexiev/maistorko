import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ZnachkiProto } from "./proto";

export const metadata: Metadata = { title: "Проба: значките горе", robots: { index: false } };

/**
 * Planning prototype for the marks in the site header („Съобщения“ and the bell): three variants
 * (Две точки, Число на звънчето, Точка след думата), four states. All state local, nothing saved. Not reachable in production.
 * ?v=1|2|3 picks the variant, ?s=1|2|3|4 the state.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ v?: string; s?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const pick = (x: string | undefined, max: number) => Math.min(Math.max(Number.parseInt(x ?? "1", 10) || 1, 1), max);
  return <ZnachkiProto initialVariant={pick(sp.v, 3) - 1} initialState={pick(sp.s, 4)} />;
}
