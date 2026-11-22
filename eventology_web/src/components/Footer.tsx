import Link from "next/link";
import { Shield, ShieldCheck, CheckCircle2, PhoneCall, Globe, Lock, Cpu } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-[rgba(212,175,55,0.18)] bg-[#040507] text-slate-400 py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 space-y-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#AA820A] text-black">
                <Shield className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-syne text-lg font-black tracking-widest text-white">
                  EVENTALOGY
                </span>
                <span className="font-syne text-xs font-bold tracking-widest text-[#D4AF37] uppercase">
                  INTERNATIONAL
                </span>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-400 max-w-sm">
              The sovereign execution infrastructure for state summits, royal arena galas, and mega-festivals.
              Engineered on mathematical spatial solvers, NBC 2016 life safety proofs, and 25/50/25 milestone escrow protocols.
            </p>
            <div className="pt-2">
              <span className="inline-block rounded-md bg-white/5 px-3 py-1 text-xs font-mono text-slate-400 border border-white/10">
                CIN: U72900CT2026PTC018920 • GSTIN: 22AABCE1234F1Z8
              </span>
            </div>
          </div>

          {/* Platform & Web App */}
          <div>
            <h3 className="text-xs font-mono font-bold tracking-widest text-white uppercase mb-4">
              Platform &amp; Web App
            </h3>
            <ul className="space-y-2.5 text-sm font-mono text-xs">
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
                  Reverse-Auction Matrix
                </Link>
              </li>
              <li>
                <Link href="/escrow" className="hover:text-white transition-colors">
                  25/50/25 Milestone Escrow
                </Link>
              </li>
            </ul>
          </div>

          {/* Global Palaces & Venues */}
          <div>
            <h3 className="text-xs font-mono font-bold tracking-widest text-white uppercase mb-4">
              Global Palaces
            </h3>
            <ul className="space-y-2.5 text-sm font-mono text-xs">
              <li>
                <Link href="/venues" className="hover:text-white transition-colors">
                  Jaipur Rambagh Courtyard
                </Link>
              </li>
              <li>
                <Link href="/venues" className="hover:text-white transition-colors">
                  Dubai Harbour Mega-Arena
                </Link>
              </li>
              <li>
                <Link href="/venues" className="hover:text-white transition-colors">
                  London Westminster Grand Hall
                </Link>
              </li>
              <li>
                <Link href="/venues" className="hover:text-white transition-colors">
                  Raipur Imperial Palace
                </Link>
              </li>
              <li>
                <span className="text-slate-500">Singapore • Zurich • Goa • Bilaspur</span>
              </li>
            </ul>
          </div>

          {/* Trust & Support */}
          <div>
            <h3 className="text-xs font-mono font-bold tracking-widest text-white uppercase mb-4">
              Governance &amp; Trust
            </h3>
            <ul className="space-y-2.5 text-sm font-mono text-xs">
              <li>
                <Link href="/contact" className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors">
                  <PhoneCall className="h-3.5 w-3.5 text-[#FFD700]" />
                  <span>+91 771 400 9000 (Dispatch)</span>
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">
                  Enterprise RFQ Specification
                </Link>
              </li>
              <li>
                <Link href="/escrow" className="hover:text-white transition-colors">
                  Escrow Dispute Arbitration
                </Link>
              </li>
              <li className="pt-2 flex items-center gap-2 text-xs">
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

        {/* Global Telemetry & Trust Badges Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8 border-t border-white/10 text-xs font-mono">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-[#10B981]" />
            <div>
              <div className="font-bold text-white uppercase">NBC 2016 Part 4</div>
              <div className="text-slate-500 text-[10px]">Life-Safety Certified</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#D4AF37]" />
            <div>
              <div className="font-bold text-white uppercase">RBI Regulated Escrow</div>
              <div className="text-slate-500 text-[10px]">Dual-Key Custodial Accounts</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-[#38BDF8]" />
            <div>
              <div className="font-bold text-white uppercase">SAT 2D Solver</div>
              <div className="text-slate-500 text-[10px]">11.4ms Collision Engine</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-emerald-400" />
            <div>
              <div className="font-bold text-white uppercase">Telemetry: 99.98%</div>
              <div className="text-slate-500 text-[10px]">Zurich • London • Dubai</div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono">
          <p>© 2026 Eventalogy International Directorate. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 rounded bg-[#10B981]/10 px-2.5 py-1 font-bold text-[#10B981] border border-[#10B981]/20">
              <ShieldCheck className="h-3.5 w-3.5" />
              ISO 20121 CERTIFIED
            </span>
            <span className="flex items-center gap-1 rounded bg-[#D4AF37]/10 px-2.5 py-1 font-bold text-[#D4AF37] border border-[#D4AF37]/20">
              <CheckCircle2 className="h-3.5 w-3.5" />
              ₹1,420 CR ESCROW DISBURSED
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
