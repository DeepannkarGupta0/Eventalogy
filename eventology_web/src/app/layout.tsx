import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en" className="light">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Playfair+Display:ital,wght@0,600;0,700;0,800;1,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#FAF8F5] text-[#18181B] antialiased min-h-screen font-outfit selection:bg-[#FDE68A] selection:text-[#78350F]">
        <main>{children}</main>
      </body>
    </html>
  );
}
