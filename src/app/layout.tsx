import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import { Footer } from "@/components/layout/Footer";
import { Nav } from "@/components/layout/Nav";
import "./globals.css";

const display = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
  display: "swap",
});
const serif = Newsreader({
  subsets: ["latin", "latin-ext"],
  variable: "--font-serif",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});
const body = Inter({ subsets: ["latin", "latin-ext"], variable: "--font-body", display: "swap" });
const mono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const SITE = process.env.SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "Tauplo: finansinis raštingumas per praktiką", template: "%s | Tauplo" },
  description:
    "Žaidimai, trumpi kursai ir skaičiuoklės su tikrais Lietuvos pavyzdžiais: biudžetas, taupymas, mokesčiai, pensijos ir apsauga nuo sukčių.",
  openGraph: {
    type: "website",
    locale: "lt_LT",
    siteName: "Tauplo",
    title: "Tauplo: finansinis raštingumas per praktiką",
    description: "Išmok valdyti pinigus per žaidimus, kursus ir skaičiuokles.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f3" },
    { media: "(prefers-color-scheme: dark)", color: "#131416" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lt" className={`${display.variable} ${serif.variable} ${body.variable} ${mono.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans">
        <a
          href="#turinys"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-brand focus:px-4 focus:py-2 focus:text-on-brand"
        >
          Pereiti prie turinio
        </a>
        <Nav />
        <main id="turinys" className="flex-1 pt-16">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
