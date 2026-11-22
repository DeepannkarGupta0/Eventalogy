import Link from "next/link";
import { Sparkles, ShieldCheck, Instagram, MessageCircle, Laptop, ArrowUpRight, Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#05060A] text-slate-400 py-16 lg:py-20 relative z-10">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 space-y-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
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
            <p className="text-sm leading-relaxed text-slate-300 max-w-sm">
              The flagship global platform for royal weddings, stadium concerts, and luxury corporate summits. Plan in 3D, chat with our bots, and book verified services with 100% milestone payment security.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://wa.me/917714009000?text=Hi%20Eventalogy!%20I%20would%20like%20to%20plan%20an%20event."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>WhatsApp Bot</span>
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg border border-pink-500/30 bg-pink-500/10 px-3 py-1.5 text-xs font-bold text-pink-400 hover:bg-pink-500/20"
              >
                <Instagram className="h-3.5 w-3.5" />
                <span>Instagram</span>
              </a>
            </div>
          </div>

          {/* Access Channels */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-white uppercase mb-4">
              Enter The Platform
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/app" className="text-[#FFD700] font-bold hover:underline flex items-center gap-1">
                  <Laptop className="h-4 w-4" />
                  <span>Web App Studio</span>
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
              </li>
              <li>
                <a
                  href="https://wa.me/917714009000?text=Hi%20Eventalogy!"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  <span>WhatsApp Concierge</span>
                </a>
              </li>
              <li>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Instagram Reels &amp; Inspiration
                </a>
              </li>
              <li>
                <Link href="/escrow" className="hover:text-white transition-colors">
                  100% Escrow Protection
                </Link>
              </li>
            </ul>
          </div>

          {/* Services & Venues */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-white uppercase mb-4">
              Events &amp; Venues
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/venues" className="hover:text-white transition-colors">
                  Palaces &amp; Heritage Forts
                </Link>
              </li>
              <li>
                <Link href="/venues" className="hover:text-white transition-colors">
                  Beach Resorts &amp; Lawns
                </Link>
              </li>
              <li>
                <Link href="/vendors" className="hover:text-white transition-colors">
                  Concert Sound &amp; Intelligent Lighting
                </Link>
              </li>
              <li>
                <Link href="/vendors" className="hover:text-white transition-colors">
                  Mandap &amp; Thematic Decor
                </Link>
              </li>
              <li>
                <Link href="/vendors" className="hover:text-white transition-colors">
                  Royal Banquets &amp; Catering
                </Link>
              </li>
            </ul>
          </div>

          {/* Company & Support */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-white uppercase mb-4">
              Company &amp; Legal
            </h3>
            <ul className="space-y-2.5 text-sm">
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

        {/* Bottom Strip */}
        <div className="border-t border-white/10 pt-8 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Eventalogy International Directorate &bull; 100% Milestone Protected</span>
          </div>
          <div>
            <span>&copy; {new Date().getFullYear()} Eventalogy International Ltd. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
