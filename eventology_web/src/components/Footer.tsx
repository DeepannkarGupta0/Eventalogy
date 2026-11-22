import Link from "next/link";
import { Building2, ShieldCheck, CheckCircle2, PhoneCall } from "lucide-react";

export default function Footer() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.eventology.in";

  return (
    <footer className="border-t border-white/10 bg-[#040507] text-slate-400 py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFD700] to-[#B8860B]">
                <Building2 className="h-5 w-5 text-black" />
              </div>
              <span className="text-lg font-black tracking-widest text-white">
                EVENTOLOGY
              </span>
            </div>
            <p className="text-sm leading-relaxed text-slate-400 max-w-sm">
              The deterministic event engineering and production marketplace. Built on mathematical spatial solvers, NBC 2016 life safety proofs, and institutional 25/50/25 milestone escrow.
            </p>
            <div className="pt-2">
              <span className="inline-block rounded-md bg-white/5 px-3 py-1 text-xs font-mono text-slate-400 border border-white/10">
                CIN: U72900CT2026PTC018920 • GSTIN: 22AABCE1234F1Z8
              </span>
            </div>
          </div>

          {/* Platform & Tech */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-white uppercase mb-4">
              Platform & Web App
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/app" className="text-[#FFD700] font-bold hover:underline flex items-center gap-1.5">
                  <span>Launch Web App (/app)</span>
                </Link>
              </li>
              <li>
                <Link href="/technology" className="hover:text-white transition-colors">
                  OpenCV Blueprint Vectorizer
                </Link>
              </li>
              <li>
                <Link href="/technology" className="hover:text-white transition-colors">
                  NBC 2016 Egress Engine
                </Link>
              </li>
              <li>
                <Link href="/technology" className="hover:text-white transition-colors">
                  SAT 2D Spatial Solver
                </Link>
              </li>
              <li>
                <Link href="/vendors" className="hover:text-white transition-colors">
                  Reverse-Auction Procurement
                </Link>
              </li>
              <li>
                <Link href="/escrow" className="hover:text-white transition-colors">
                  25/50/25 Milestone Escrow
                </Link>
              </li>
            </ul>
          </div>

          {/* Catalogs & Venues */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-white uppercase mb-4">
              Catalogs & Cities
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/venues" className="hover:text-white transition-colors">
                  Heritage Palaces & Forts
                </Link>
              </li>
              <li>
                <Link href="/venues" className="hover:text-white transition-colors">
                  Open Lawns & Resorts
                </Link>
              </li>
              <li>
                <Link href="/vendors" className="hover:text-white transition-colors">
                  Concert Line Array Audio
                </Link>
              </li>
              <li>
                <Link href="/vendors" className="hover:text-white transition-colors">
                  Intelligent Truss & Staging
                </Link>
              </li>
              <li>
                <span className="text-slate-500">Raipur • Bilaspur • Delhi • Goa</span>
              </li>
            </ul>
          </div>

          {/* Trust & Operations */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-white uppercase mb-4">
              Trust & Support
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href={`${appUrl}/become-vendor`} className="hover:text-white transition-colors">
                  Become a Certified Vendor
                </a>
              </li>
              <li>
                <Link href="/contact" className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors">
                  <PhoneCall className="h-3.5 w-3.5 text-[#FFD700]" />
                  <span>+91 771 400 9000 (Dispatch)</span>
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Contact & Enterprise RFQ
                </Link>
              </li>
              <li>
                <Link href="/escrow" className="hover:text-white transition-colors">
                  Escrow Dispute Resolution
                </Link>
              </li>
              <li className="flex items-center gap-2 text-xs">
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
                <span>•</span>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
          <p>© 2026 Eventology Technology Solutions Pvt. Ltd. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 rounded bg-[#10B981]/10 px-2.5 py-1 font-bold text-[#10B981] border border-[#10B981]/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              NBC 2016 COMPLIANT
            </span>
            <span className="flex items-center gap-1 rounded bg-[#FFD700]/10 px-2.5 py-1 font-bold text-[#FFD700] border border-[#FFD700]/20">
              <CheckCircle2 className="h-3.5 w-3.5" />
              ESCROW PROTECTED
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
