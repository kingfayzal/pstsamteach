import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Kalam } from "next/font/google";
import { TimeZoneSync } from "@/components/shell/time-zone-sync";
import { SITE } from "@/lib/site";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  // next/font has no metrics for this family yet, so use a system fallback.
  adjustFontFallback: false,
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

// The share image is opengraph-image.png beside this file. Pages set only a
// title and description: an `openGraph` object on a page would drop the image.
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  openGraph: { type: "website", siteName: SITE.name, locale: "en_GB" },
};

export const viewport: Viewport = {
  themeColor: "#f5f8fc",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${atkinson.variable} ${kalam.variable} antialiased`}>
      <body className="min-h-dvh">
        <TimeZoneSync />
        {children}
      </body>
    </html>
  );
}
