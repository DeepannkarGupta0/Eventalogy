import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Eventalogy International | Luxury Events, Grand Venues & Production Platform",
  description:
    "Eventalogy International — The premier global platform for luxury weddings, stadium concerts, corporate galas, and celebrations. Handpicked venues, verified 5-star vendors, and an all-in-one digital planning studio.",
  keywords: [
    "Eventalogy International",
    "luxury event management",
    "destination wedding planners",
    "royal wedding palaces",
    "concert audio and lighting",
    "event venues and banquet halls",
    "corporate summit production",
    "event planning web app",
    "event milestone escrow",
  ],
  authors: [{ name: "Eventalogy International" }],
  openGraph: {
    title: "Eventalogy International | Luxury Events, Grand Venues & Production Platform",
    description:
      "Curating extraordinary celebrations, royal weddings, stadium concerts, and global summits. Handpicked venues, verified 5-star vendors, and milestone escrow.",
    url: "https://eventology-website.vercel.app",
    siteName: "Eventalogy International",
    images: [
      {
        url: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1200&auto=format&fit=crop",
        width: 1200,
        height: 630,
        alt: "Eventalogy International",
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Eventalogy International | Luxury Events, Grand Venues & Production Platform",
    description:
      "Curating extraordinary celebrations, royal weddings, stadium concerts, and global summits. Handpicked venues, verified 5-star vendors, and milestone escrow.",
    images: ["https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=1200&auto=format&fit=crop"],
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
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Syne:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#070709] text-white antialiased min-h-screen flex flex-col font-outfit selection:bg-[#FFD700] selection:text-black">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
