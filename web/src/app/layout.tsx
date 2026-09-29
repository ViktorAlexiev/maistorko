import type { Metadata, Viewport } from "next";
import { Sofia_Sans, Sofia_Sans_Extra_Condensed } from "next/font/google";
import { Toaster } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import "./globals.css";

const sofia = Sofia_Sans({
  subsets: ["cyrillic", "latin"],
  variable: "--font-sofia",
  display: "swap",
});

const condensed = Sofia_Sans_Extra_Condensed({
  subsets: ["cyrillic", "latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-condensed",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Майсторко: виж кой майстор е свободен",
    template: "%s | Майсторко",
  },
  description:
    "Намери майстор, който може да свърши работата, виж цените му и кога е свободен, после просто му пиши. Електротехници, ВиК, бояджии, плочкаджии и още.",
  applicationName: "Майсторко",
  openGraph: {
    type: "website",
    locale: "bg_BG",
    siteName: "Майсторко",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#f3f2ed",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bg" className={`${sofia.variable} ${condensed.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-rule focus:px-4 focus:py-2 focus:font-bold"
        >
          Към съдържанието
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              fontFamily: "var(--font-sofia)",
              borderRadius: "8px",
              border: "1px solid var(--line)",
              color: "var(--ink)",
            },
          }}
        />
      </body>
    </html>
  );
}
