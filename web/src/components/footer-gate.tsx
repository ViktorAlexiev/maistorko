"use client";

import { usePathname } from "next/navigation";

/** On a phone the messages pages are a full-screen app: the dark end of the site stays out of sight there. */
export function FooterGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/saobshtenia")) return <div className="max-md:hidden">{children}</div>;
  return children;
}
