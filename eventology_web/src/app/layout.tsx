import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Eventology | Deterministic Event Production & Marketplace Platform",
  description:
    "Institutional event architecture for corporate galas, stadium concerts, and luxury weddings. Built on mathematical spatial solvers, NBC 2016 life safety proofs, and 25/50/25 milestone escrow.",
  keywords: [
    "event production India",
    "wedding venues Raipur",
    "concert line array audio",
    "event CAD floorplan",
    "NBC 2016 life safety",
    "event milestone escrow",
    "reverse auction event gear",
  ],
  authors: [{ name: "Eventology Technology Solutions Pvt. Ltd." }],
  openGraph: {
    title: "Eventology | Deterministic Event Production Platform",
    description:
      "Mathematical Spatial Solvers • NBC 2016 Life Safety Proofs • 25/50/25 Milestone Escrow • Zero AI Hallucinations.",
    url: "https://eventology.in",
    siteName: "Eventology",
    images: [
      {
        url: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=1200&auto=format&fit=crop",
        width: 1200,
        height: 630,
        alt: "Eventology Flagship Event Production Platform",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Eventology | Deterministic Event Production Platform",
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
      <body className="bg-[#070709] text-white antialiased min-h-screen flex flex-col selection:bg-[#FFD700] selection:text-black">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
