import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Eventalogy International | Deterministic Global Event Production & Engineering Platform",
  description:
    "Eventalogy International — Sovereign Staging & Spatial Architecture. Eliminating catastrophic live event failures through mathematical spatial solvers, NBC 2016 life safety proofs, and 25/50/25 milestone escrow protocols.",
  keywords: [
    "Eventalogy International",
    "global event production",
    "luxury wedding palaces",
    "concert audio line array",
    "event CAD floorplan",
    "NBC 2016 life safety",
    "25/50/25 milestone escrow",
    "reverse auction event gear",
  ],
  authors: [{ name: "Eventalogy International Directorate" }],
  openGraph: {
    title: "Eventalogy International | Deterministic Global Event Production Platform",
    description:
      "Sovereign Staging & Spatial Architecture • Mathematical Spatial Solvers • NBC 2016 Life Safety Proofs • 25/50/25 Milestone Escrow.",
    url: "https://eventology-website.vercel.app",
    siteName: "Eventalogy International",
    images: [
      {
        url: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=1200&auto=format&fit=crop",
        width: 1200,
        height: 630,
        alt: "Eventalogy International Flagship Platform",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Eventalogy International | Sovereign Staging & Spatial Architecture",
    description:
      "Mathematical Spatial Solvers, NBC 2016 Life Safety Proofs, and 25/50/25 Milestone Escrow.",
    images: ["https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=1200&auto=format&fit=crop"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Syne:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#070709] text-white antialiased min-h-screen flex flex-col font-sans selection:bg-[#D4AF37] selection:text-black">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
