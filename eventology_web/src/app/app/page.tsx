"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Laptop,
  Smartphone,
  ShieldCheck,
  Building2,
  Cpu,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  Zap,
  Users,
  Layers,
  Download,
  Globe,
  Radio,
  Lock,
} from "lucide-react";

export default function WebAppGatewayPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.eventology.in";
  const [embedActive, setEmbedActive] = useState(false);

  return (
    <div className="min-h-screen bg-[#070709] text-white pb-24">
      {/* ── 1. Header Banner & Status ────────────────────────────────────────── */}
      <section className="relative pt-12 md:pt-16 pb-12 px-6 lg:px-8 border-b border-white/10 bg-gradient-to-b from-[#101422] to-[#070709]">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-emerald-400">
                Eventology Web Studio Engine • Online
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                v1.2.0 Production Release
              </span>
              <span className="rounded-full border border-[#FFD700]/30 bg-[#FFD700]/10 px-3 py-1 text-xs font-bold text-[#FFD700]">
                Zero Installation Required
              </span>
            </div>
          </div>

          <div className="max-w-4xl">
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
              Access Eventology <span className="gold-gradient-text">Anywhere</span>
            </h1>
            <p className="mt-4 text-lg sm:text-xl text-slate-300 leading-relaxed max-w-3xl">
              Experience the complete Eventology platform right in your browser. Whether you are an event client planning a luxury wedding, a certified audio/visual contractor submitting reverse auction tenders, or a venue director managing physical facilities, launch your studio in one click.
            </p>
          </div>

          {/* Quick Action Bar */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#E6B800] px-7 py-3.5 text-base font-bold text-black shadow-[0_0_30px_rgba(255,215,0,0.35)] hover:brightness-110 transition-all"
            >
              <span>Launch Fullscreen Web App</span>
              <ExternalLink className="h-4 w-4" />
            </a>

            <button
              onClick={() => setEmbedActive(!embedActive)}
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-base font-medium text-white hover:bg-white/10 transition-all"
            >
              <Laptop className="h-4 w-4 text-[#FFD700]" />
              <span>{embedActive ? "Close In-Browser Frame" : "Preview In-Browser Web App"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── 2. In-Browser Embed or Visual Frame ──────────────────────────────── */}
      {embedActive && (
        <section className="px-6 lg:px-8 py-8 bg-[#040507] border-b border-white/10">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-3xl border border-[#FFD700]/30 bg-[#0E121E] overflow-hidden shadow-2xl">
              {/* Browser chrome header */}
              <div className="flex items-center justify-between border-b border-white/10 bg-[#080B12] px-6 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-rose-500/80"></div>
                  <div className="h-3 w-3 rounded-full bg-amber-500/80"></div>
                  <div className="h-3 w-3 rounded-full bg-emerald-500/80"></div>
                  <span className="ml-3 font-mono text-xs text-slate-400">
                    https://app.eventology.in
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href={appUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-bold text-[#FFD700] hover:underline"
                  >
                    <span>Open in new window</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => setEmbedActive(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              {/* Embedded Frame / Fallback */}
              <div className="relative w-full h-[650px] bg-[#070709] flex flex-col items-center justify-center p-8">
                <iframe
                  src={appUrl}
                  title="Eventology Live Web App"
                  className="w-full h-full border-0 rounded-b-2xl"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── 3. Role-Based Gateway Cards ────────────────────────────────────── */}
      <section className="px-6 lg:px-8 pt-16">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <span className="text-xs font-bold tracking-widest text-[#FFD700] uppercase">
              Role-Specific Portals
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-2">
              Select Your Access Terminal
            </h2>
            <p className="mt-2 text-slate-400 text-sm sm:text-base leading-relaxed">
              Every participant in the event production supply chain gets a tailored workspace designed for zero latency and mathematical precision.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: Client & Organizer */}
            <div className="group rounded-3xl border border-white/10 bg-[#121624] p-7 flex flex-col justify-between hover:border-[#FFD700]/50 transition-all shadow-xl">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFD700]/15 text-[#FFD700]">
                  <Users className="h-6 w-6" />
                </div>
                <span className="mt-5 inline-block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                  CLIENT & ORGANIZER
                </span>
                <h3 className="mt-2 text-xl font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  Event Studio
                </h3>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                  Design CAD floorplans, test NBC 2016 spatial safety, browse certified palaces, and assemble your production team.
                </p>

                <ul className="mt-5 space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" />
                    <span>Interactive CAD Seating Canvas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" />
                    <span>Automated Vendor Tender Engine</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" />
                    <span>25/50/25 Milestone Escrow Vault</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-white/10">
                <a
                  href={`${appUrl}/venues`}
                  className="flex items-center justify-between w-full rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-[#FFD700] hover:text-black transition-all"
                >
                  <span>Enter Client Studio</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Card 2: Production Crew & Vendor */}
            <div className="group rounded-3xl border border-white/10 bg-[#121624] p-7 flex flex-col justify-between hover:border-[#FFD700]/50 transition-all shadow-xl">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400">
                  <Zap className="h-6 w-6" />
                </div>
                <span className="mt-5 inline-block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                  CONTRACTOR / CREW
                </span>
                <h3 className="mt-2 text-xl font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  Vendor Terminal
                </h3>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                  Participate in live reverse auction bids, manage gear inventories, and track automated milestone payouts directly to bank account.
                </p>

                <ul className="mt-5 space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Live Reverse-Auction Bids</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Line-Array & Truss Inventory</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Guaranteed Escrow Payouts</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-white/10">
                <a
                  href={`${appUrl}/become-vendor`}
                  className="flex items-center justify-between w-full rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 hover:text-white transition-all"
                >
                  <span>Access Vendor Portal</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Card 3: Venue & Palace Partner */}
            <div className="group rounded-3xl border border-white/10 bg-[#121624] p-7 flex flex-col justify-between hover:border-[#FFD700]/50 transition-all shadow-xl">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                  <Building2 className="h-6 w-6" />
                </div>
                <span className="mt-5 inline-block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                  VENUE PARTNER
                </span>
                <h3 className="mt-2 text-xl font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  Property Hub
                </h3>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                  Upload architectural blueprints for vectorization, certify 3-phase power loads, and manage VIP bookings with institutional certainty.
                </p>

                <ul className="mt-5 space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />
                    <span>Auto Blueprint Vectorization</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />
                    <span>3-Phase Power Load Audits</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-amber-400" />
                    <span>Zero Double-Booking Guarantee</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-white/10">
                <a
                  href={`${appUrl}/venues`}
                  className="flex items-center justify-between w-full rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-500 hover:text-black transition-all"
                >
                  <span>Access Venue Hub</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Card 4: Safety & Admin Governance */}
            <div className="group rounded-3xl border border-white/10 bg-[#121624] p-7 flex flex-col justify-between hover:border-[#FFD700]/50 transition-all shadow-xl">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <span className="mt-5 inline-block text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                  TRUST & COMPLIANCE
                </span>
                <h3 className="mt-2 text-xl font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  Trust Terminal
                </h3>
                <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                  Review 5-tier KYC certifications, verify municipal fire egress paths, and manage multi-signature cryptographic escrow releases.
                </p>

                <ul className="mt-5 space-y-2 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>NBC 2016 Egress Certificate</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Tier 1-5 KYC Verification</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Multi-Sig Escrow Sign-Offs</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-white/10">
                <a
                  href={`${appUrl}/admin`}
                  className="flex items-center justify-between w-full rounded-xl bg-white/10 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 hover:text-black transition-all"
                >
                  <span>Open Trust Terminal</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Cross-Platform & Device Parity ───────────────────────────────── */}
      <section className="px-6 lg:px-8 pt-20">
        <div className="mx-auto max-w-7xl rounded-3xl border border-white/10 bg-[#0E121E] p-8 md:p-12 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="rounded-full bg-emerald-500/10 px-3.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                True Multi-Screen Parity
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Runs on Desktop Browsers, Tablets, and On-Ground Mobiles
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Eventology is built with responsive Flutter 3.x web technology. Your CAD diagrams, stage layouts, and RFQ bids synchronize seamlessly across any screen without data loss or UI distortion.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-[#FFD700]">
                    <Laptop className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">Desktop Web App (Chrome / Safari / Edge)</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Full 1320px ultra-wide canvas, multi-window layout, high-frequency SAT geometry solver, and live reverse auction bidding stream.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-emerald-400">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">Mobile PWA & Native Android</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Designed for on-site production teams: quick stage checklist, walkie-talkie crew dispatch, real-time decibel check, and milestone QR scanning.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-4">
                <a
                  href={appUrl}
                  className="rounded-xl bg-[#FFD700] px-6 py-3 text-sm font-bold text-black hover:brightness-110 transition-all shadow-lg"
                >
                  Launch Web App Now
                </a>
                <a
                  href="/download/eventology-release.apk"
                  className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors"
                >
                  <Download className="h-4 w-4 text-[#FFD700]" />
                  <span>Download Android APK</span>
                </a>
              </div>
            </div>

            {/* Visual Screen Preview */}
            <div className="relative rounded-2xl border border-white/15 bg-black/60 p-4 shadow-2xl overflow-hidden">
              <div className="rounded-xl border border-white/10 bg-[#121624] p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
                    <span className="text-xs font-mono font-bold text-white">Eventology Studio Runtime</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">FPS: 60 • WebGL Active</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg bg-white/5 p-3 border border-white/5">
                    <div className="text-slate-400 text-[10px] uppercase">SAT Solver State</div>
                    <div className="font-bold text-emerald-400 mt-0.5">0 Intersections</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3 border border-white/5">
                    <div className="text-slate-400 text-[10px] uppercase">NBC 2016 Proof</div>
                    <div className="font-bold text-[#FFD700] mt-0.5">Compliant (1.8m Aisle)</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3 border border-white/5">
                    <div className="text-slate-400 text-[10px] uppercase">Active RFQ Pool</div>
                    <div className="font-bold text-white mt-0.5">14 Certified Bids</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3 border border-white/5">
                    <div className="text-slate-400 text-[10px] uppercase">Escrow Status</div>
                    <div className="font-bold text-indigo-400 mt-0.5">25% Advance Locked</div>
                  </div>
                </div>

                <div className="rounded-lg bg-black/40 border border-white/5 p-3">
                  <div className="text-[10px] font-mono text-slate-400">
                    &gt; spatial_engine: vectorizing blueprint_imperial_hall.png<br />
                    &gt; sat_solver: polygon boundary validated (350 pax, 8 egress paths)<br />
                    &gt; milestone_vault: multi-sig contract verified on-chain
                  </div>
                </div>

                <a
                  href={appUrl}
                  className="block text-center rounded-xl bg-gradient-to-r from-[#FFD700] to-[#E6B800] py-3 text-xs font-bold text-black hover:brightness-110 transition-all shadow-md"
                >
                  Enter Live Studio Environment →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Client System Compatibility Check ────────────────────────────── */}
      <section className="px-6 lg:px-8 pt-16">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-white/10 bg-[#0B0E17] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FFD700]/15 text-[#FFD700]">
                <Cpu className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">Browser Compatibility Verified</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  Compatible with Chrome 90+, Safari 15+, Firefox 90+, Microsoft Edge, and modern mobile browsers with WebGL 2.0 and WebAssembly acceleration.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <a
                href={appUrl}
                className="rounded-xl border border-[#FFD700]/40 bg-[#FFD700]/10 px-5 py-2.5 text-xs font-bold text-[#FFD700] hover:bg-[#FFD700] hover:text-black transition-all"
              >
                Launch Studio Direct →
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
