import Link from "next/link";
import { Sparkles, ShieldCheck, Heart, MapPin, Phone, Mail, ArrowUpRight } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-[#D4AF37]/20 bg-[#040507] text-slate-400 py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 space-y-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#AA820A] text-black">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-syne text-xl font-black tracking-wider text-white">
                  EVENTALOGY
                </span>
                <span className="font-syne text-xs font-bold tracking-widest text-[#D4AF37] uppercase">
                  INTERNATIONAL
                </span>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-400 max-w-sm">
              The world&apos;s premier platform for extraordinary events, royal destination weddings, stadium concerts, and luxury corporate galas. Verified venues, top-tier vendors, and complete peace of mind.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-[#10B981]">
              <ShieldCheck className="h-4 w-4" />
              <span>100% Escrow Milestone Protected &bull; ISO 20121 Certified</span>
            </div>
          </div>

          {/* Event Experiences */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-white uppercase mb-4">
              Events We Curate
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/venues" className="hover:text-white transition-colors">
                  Royal Destination Weddings
                </Link>
              </li>
              <li>
                <Link href="/venues" className="hover:text-white transition-colors">
                  Music Festivals &amp; Concerts
                </Link>
              </li>
              <li>
                <Link href="/venues" className="hover:text-white transition-colors">
                  Corporate Summits &amp; Galas
                </Link>
              </li>
              <li>
                <Link href="/venues" className="hover:text-white transition-colors">
                  Private VIP Celebrations
                </Link>
              </li>
              <li>
                <Link href="/venues" className="hover:text-white transition-colors">
                  Exhibitions &amp; Expos
                </Link>
              </li>
            </ul>
          </div>

          {/* Venues & Services */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-white uppercase mb-4">
              Venues &amp; Vendors
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/venues" className="hover:text-white transition-colors">
                  Heritage Forts &amp; Palaces
                </Link>
              </li>
              <li>
                <Link href="/venues" className="hover:text-white transition-colors">
                  5-Star Ballrooms &amp; Lawns
                </Link>
              </li>
              <li>
                <Link href="/vendors" className="hover:text-white transition-colors">
                  Concert Sound &amp; Lighting
                </Link>
              </li>
              <li>
                <Link href="/vendors" className="hover:text-white transition-colors">
                  Bespoke Decor &amp; Floral Design
                </Link>
              </li>
              <li>
                <Link href="/vendors" className="hover:text-white transition-colors">
                  Royal Catering &amp; Mixology
                </Link>
              </li>
            </ul>
          </div>

          {/* Digital Web App & Support */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-white uppercase mb-4">
              Platform &amp; Legal
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/app" className="text-[#FFD700] font-bold hover:underline flex items-center gap-1">
                  <span>Event Web App Studio</span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </li>
              <li>
                <Link href="/escrow" className="hover:text-white transition-colors">
                  25/50/25 Milestone Escrow
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Book a Consultation
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Global Cities Strip */}
        <div className="border-t border-white/10 pt-8 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-slate-400 font-semibold">Active Hubs:</span>
            <span>Jaipur</span>
            <span>&bull;</span>
            <span>Mumbai</span>
            <span>&bull;</span>
            <span>New Delhi</span>
            <span>&bull;</span>
            <span>Udaipur</span>
            <span>&bull;</span>
            <span>Goa</span>
            <span>&bull;</span>
            <span>Dubai</span>
            <span>&bull;</span>
            <span>London</span>
          </div>
          <div>
            <span>&copy; {new Date().getFullYear()} Eventalogy International Ltd. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
