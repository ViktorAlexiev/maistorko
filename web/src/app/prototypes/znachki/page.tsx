import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ZnachkiProto } from "./proto";

export const metadata: Metadata = { title: "Проба: значките горе", robots: { index: false } };

/**
 * Planning prototype for the marks in the site header („Съобщения“ and the bell): the approved „Като в профила“ (the dot on „Съобщения“,
 * the bell is the red count), four states. All state local, nothing saved. Not reachable in production.
 * ?s=1|2|3|4 picks the state.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const s = Math.min(Math.max(Number.parseInt(sp.s ?? "1", 10) || 1, 1), 4);
  return <ZnachkiProto initialState={s} />;
}
