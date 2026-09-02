import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Job Mapper — Source-Grounded Geospatial Job Discovery",
  description: "Discover verified employment opportunities on an interactive map directly from authentic company career portals, ATS feeds, and official sources.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-50">
      <body className="h-full antialiased text-slate-900 overflow-hidden font-sans">
        {children}
      </body>
    </html>
  );
}
