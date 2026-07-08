import type { Metadata } from "next";
import { Schibsted_Grotesk, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

// Daylight theme: Schibsted Grotesk for UI, Spline Sans Mono for all
// figures/labels. Self-hosted via next/font: font-display swap, no layout
// shift, no render-blocking <link>. --font-display is aliased to --font in
// globals.css (the daylight theme has no editorial serif).
const sans = Schibsted_Grotesk({
  subsets: ["latin"],
  variable: "--font",
  display: "swap",
});
const mono = Spline_Sans_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Galileo — Content Observatory",
  description: "EssilorLuxottica content production & coverage observatory.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
