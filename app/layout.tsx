import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Digitalni tajnik — Karate klub",
  description: "Moderna platforma za upravljanje karate klubovima i sportskim udrugama",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hr" className="h-full">
      <body className="h-full bg-slate-950 text-slate-50 antialiased">
        {children}
      </body>
    </html>
  );
}
