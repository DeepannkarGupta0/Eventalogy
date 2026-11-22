"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Shield,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowRight,
  Gavel,
  Lock,
  Star,
  CheckCircle2,
  FileCode2,
  Laptop,
  Smartphone,
  ExternalLink,
  Zap,
  Terminal,
  Activity,
  Globe,
  Radio,
  Sliders,
  Download,
  AlertTriangle,
} from "lucide-react";

export default function HomePage() {
  // Spec Matrix State
  const [occupancyIndex, setOccupancyIndex] = useState(2); // 10,000 Arena Summit
  const [selectedDestination, setSelectedDestination] = useState(0); // Jaipur
  const [cadViewMode, setCadViewMode] = useState<"2D" | "3D" | "STRESS">("3D");

  // Escrow Vault State
  const [escrowLakhs, setEscrowLakhs] = useState(500); // 5.0 Crores default

  const occupancyOptions = [
    { label: "500 VIP", sub: "500 VIPs", truss: "18 METRIC TONS", egress: "4.0 METERS", budget: "₹38 LAKHS", usd: "$45,600" },
    { label: "2,500 SUMMIT", sub: "2,500 Summit", truss: "34 METRIC TONS", egress: "8.0 METERS", budget: "₹85 LAKHS", usd: "$102,000" },
    { label: "10K ARENA", sub: "10,000 Arena Summit", truss: "78 METRIC TONS", egress: "22.0 METERS", budget: "₹2.80 CR", usd: "$336,000" },
    { label: "50K MEGA", sub: "50,000 Stadium", truss: "160 METRIC TONS", egress: "48.0 METERS", budget: "₹8.90 CR", usd: "$1,068,000" },
    { label: "100K SOVEREIGN", sub: "100,000 Sovereign", truss: "280 METRIC TONS", egress: "84.0 METERS", budget: "₹18.50 CR", usd: "$2,220,000" },
  ];

  const destinationOptions = [
    { title: "JAIPUR RAMBAGH", subtitle: "Imperial Courtyard", note: "Heritage / Wind-Tuned", region: "India (West)" },
    { title: "DUBAI HARBOUR", subtitle: "Waterfront Pavilion", note: "Seaside Marine Grade", region: "UAE (Dubai)" },
    { title: "LONDON WESTMINSTER", subtitle: "Neoclassical Rotunda", note: "Grade-1 Acoustic Scrim", region: "UK (London)" },
  ];

  const formatEscrowDisplay = (lakhs: number) => {
    if (lakhs >= 100) {
      return `₹${(lakhs / 100).toFixed(2)} CRORES`;
    }
    return `₹${lakhs.toFixed(0)} LAKHS`;
  };

  const formatPhaseAmount = (lakhs: number) => {
    if (lakhs >= 100) {
      return `₹${(lakhs / 100).toFixed(2)} CR`;
    }
    return `₹${lakhs.toFixed(1)} LAKHS`;
  };

  const currentSpec = occupancyOptions[occupancyIndex];

  return (
    <div className="flex flex-col w-full text-white bg-[#070709] selection:bg-[#D4AF37] selection:text-black">
      {/* ── 1. Top Instrumentation Ticker ──────────────────────────────────── */}
      <section className="w-full bg-[#0A0A0E] px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-slate-400 border-b border-[rgba(212,175,55,0.15)]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[#10B981] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping"></span>
            NBC 2016 PART 4 COMPLIANT
          </span>
          <span className="text-[rgba(212,175,55,0.3)]">|</span>
          <span>ISO 20121 CERTIFIED EVENT MANAGEMENT</span>
          <span className="text-[rgba(212,175,55,0.3)]">|</span>
          <span>
            SOLVER LATENCY: <strong className="text-[#10B981]">11.4ms</strong>
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>
            GLOBAL CLUSTER: <strong className="text-[#D4AF37]">ZURICH // DUBAI // RAIPUR</strong>
          </span>
          <span className="text-[rgba(212,175,55,0.3)]">|</span>
          <span>
            ESCROW DISBURSED: <span className="text-[#D4AF37] font-bold">₹1,420 CR</span>
          </span>
        </div>
      </section>

      {/* ── 2. Monumental Hero Section ─────────────────────────────────────── */}
      <section className="relative w-full px-6 lg:px-8 pt-16 md:pt-24 pb-20 overflow-hidden bg-gradient-to-b from-[#09090D] via-[#101017] to-[#070709]">
        <div className="absolute inset-0 bg-[radial-gradient(#D4AF37_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.04] pointer-events-none"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative max-w-7xl mx-auto flex flex-col items-start gap-6">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#10131E] rounded-md border border-[rgba(212,175,55,0.25)] shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
            <span className="font-mono text-xs uppercase tracking-widest text-slate-300">
              DETERMINISTIC SPATIAL ENGINEERING &amp; PRODUCTION OS v4.8
            </span>
          </div>

          {/* Monumental Headline */}
          <h1 className="font-syne text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl leading-[1.08]">
            Eliminate Catastrophic <span className="gold-gradient-text">Live Event Failures</span> Through Computational Staging.
          </h1>

          {/* Architectural Subhead */}
          <p className="text-base sm:text-xl text-slate-300 max-w-3xl leading-relaxed">
            <strong className="text-white">Eventalogy International</strong> is the sovereign execution infrastructure for state summits, royal arena galas, and mega-festivals. Real-time SAT 2D polygon crowd clearance, automated NBC 2016 life-safety validation, and bank-grade 25/50/25 milestone escrow protocols.
          </p>

          {/* Action Row */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/app"
              className="px-8 py-4 bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#AA820A] text-black font-mono text-sm font-bold uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-[0_0_30px_rgba(212,175,55,0.35)] hover:brightness-110 transition-all"
            >
              <Terminal className="h-4 w-4" />
              <span>Launch Web App Studio</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/venues"
              className="px-7 py-4 bg-[#10131E] text-white font-mono text-sm uppercase tracking-wider rounded-xl border border-[rgba(212,175,55,0.3)] hover:border-[#D4AF37] transition-all flex items-center gap-2"
            >
              <span>Inspect 42 Global Palaces &amp; Arenas</span>
            </Link>
          </div>

          {/* Live Telemetry Matrix */}
          <div className="w-full mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#0D0E13]/90 backdrop-blur-md p-6 rounded-2xl border border-[rgba(212,175,55,0.18)] shadow-2xl">
            <div className="flex flex-col">
              <span className="font-mono text-xs text-slate-400 uppercase tracking-wider">Engineered Volume</span>
              <span className="font-syne text-2xl sm:text-3xl font-bold text-[#D4AF37] mt-1">4.82M SQ. FT.</span>
              <span className="text-xs text-[#10B981] mt-0.5">Zero-Drift Validated</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-xs text-slate-400 uppercase tracking-wider">Crowd Egress Velocity</span>
              <span className="font-syne text-2xl sm:text-3xl font-bold text-white mt-1">1.33 M/SEC</span>
              <span className="text-xs text-[#10B981] mt-0.5">NBC Part 4 Safe</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-xs text-slate-400 uppercase tracking-wider">Dual-Key Escrow</span>
              <span className="font-syne text-2xl sm:text-3xl font-bold text-[#D4AF37] mt-1">₹1,420 CR</span>
              <span className="text-xs text-slate-400 mt-0.5">RBI Regulated Escrow</span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-xs text-slate-400 uppercase tracking-wider">Structural Redundancy</span>
              <span className="font-syne text-2xl sm:text-3xl font-bold text-[#10B981] mt-1">1.45× FACTOR</span>
              <span className="text-xs text-slate-400 mt-0.5">Eurocode 9 Certified</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Parametric Global Event Spec Matrix (Interactive Dock) ───────── */}
      <section className="w-full px-6 lg:px-8 py-16 bg-[#0C0C10] border-y border-[rgba(212,175,55,0.14)]">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[rgba(212,175,55,0.1)]">
            <div>
              <span className="font-mono text-xs text-[#D4AF37] uppercase tracking-widest">
                [PARAMETRIC DOCK // SYSTEM SIMULATOR]
              </span>
              <h2 className="font-syne text-2xl sm:text-3xl font-bold text-white mt-1">
                Real-time Global Event Spec Matrix
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 max-w-md">
              Adjust scale, destination &amp; generator loads to dynamically run structural load calculations and automated budget projections.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Controls Column */}
            <div className="lg:col-span-7 space-y-6 bg-[#10131E] p-6 sm:p-8 rounded-2xl border border-[rgba(212,175,55,0.15)] shadow-xl">
              {/* Attendance Scale Control */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="font-mono text-xs uppercase text-slate-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]"></span> Occupancy Scale (Attendees)
                  </label>
                  <span className="font-mono text-xs text-[#D4AF37] font-bold">
                    {currentSpec.sub.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {occupancyOptions.map((opt, idx) => (
                    <button
                      key={opt.label}
                      onClick={() => setOccupancyIndex(idx)}
                      className={`px-3 py-2 text-center rounded-lg font-mono text-xs font-semibold transition-all ${
                        occupancyIndex === idx
                          ? "bg-[#D4AF37] text-black shadow-lg"
                          : "bg-[#181C28] text-slate-300 hover:bg-[#202535] border border-white/5"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Destination Selector */}
              <div className="space-y-2">
                <label className="font-mono text-xs uppercase text-slate-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span> Destination Staging Zone
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {destinationOptions.map((dest, idx) => (
                    <button
                      key={dest.title}
                      onClick={() => setSelectedDestination(idx)}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        selectedDestination === idx
                          ? "bg-[#181C28] border-[#D4AF37] shadow-md"
                          : "bg-[#0E1119] border-white/5 hover:border-white/20"
                      }`}
                    >
                      <span className="font-mono text-[10px] text-[#D4AF37] block font-bold">
                        {dest.title}
                      </span>
                      <span className="text-xs text-white block mt-0.5 font-medium">
                        {dest.subtitle}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Power Grid Redundancy Selector */}
              <div className="space-y-2">
                <label className="font-mono text-xs uppercase text-slate-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]"></span> 3-Phase Synchronized Grid Load
                </label>
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  <span className="px-3 py-1.5 bg-[#0A0D15] border border-[#10B981]/40 text-[#10B981] rounded-md">
                    ⚡ 1,200 kVA Synchronous Industrial Loop
                  </span>
                  <span className="px-3 py-1.5 bg-[#0A0D15] text-slate-400 rounded-md border border-white/5">
                    Dual 100% N+1 Cummins Gensets
                  </span>
                  <span className="px-3 py-1.5 bg-[#0A0D15] text-slate-400 rounded-md border border-white/5">
                    Zero-Break UPS Audio Feeds
                  </span>
                </div>
              </div>
            </div>

            {/* Calculated Live Spec Panel */}
            <div className="lg:col-span-5 bg-gradient-to-b from-[#141826] to-[#0E111A] p-6 sm:p-8 rounded-2xl border border-[rgba(212,175,55,0.3)] shadow-2xl flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.15)] pb-3">
                  <span className="font-mono text-xs text-[#D4AF37] uppercase font-bold tracking-wider">
                    DETERMINISTIC OUTPUT SPECS
                  </span>
                  <span className="font-mono text-xs text-[#10B981] flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse"></span> SOLVER SYNCED
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="bg-[#090C14] p-3.5 rounded-xl border border-white/5">
                    <span className="font-mono text-[10px] text-slate-400 uppercase block">Structural Truss Rigging</span>
                    <span className="font-syne text-lg sm:text-xl text-[#D4AF37] font-bold mt-1 block">
                      {currentSpec.truss}
                    </span>
                    <span className="text-[11px] text-slate-500 block">Prolyte B100RV Grid</span>
                  </div>
                  <div className="bg-[#090C14] p-3.5 rounded-xl border border-white/5">
                    <span className="font-mono text-[10px] text-slate-400 uppercase block">NBC Part 4 Egress Width</span>
                    <span className="font-syne text-lg sm:text-xl text-white font-bold mt-1 block">
                      {currentSpec.egress}
                    </span>
                    <span className="text-[11px] text-[#10B981] block">Primary Portals Certified</span>
                  </div>
                </div>

                <div className="bg-[#090C14] p-4 rounded-xl border border-[rgba(212,175,55,0.2)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-slate-400 uppercase">Projected Production Capex</span>
                    <span className="font-mono text-[10px] text-[#D4AF37] font-bold">AUDITED ESTIMATE</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-syne text-3xl font-extrabold text-[#D4AF37]">
                      {currentSpec.budget}
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      ({currentSpec.usd} USD)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Includes staging mechanics, line arrays, 4K Barco visual walls, dual escrow guarantee, &amp; certified structural PE stamps.
                  </p>
                </div>
              </div>

              <Link
                href="/app"
                className="mt-6 w-full py-3.5 bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-black font-mono text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 hover:brightness-110 transition-all"
              >
                <Download className="h-4 w-4" />
                <span>Generate Verified RFQ &amp; Dossier</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Sovereign Live Production Primitives ─────────────────────────── */}
      <section className="w-full px-6 lg:px-8 py-20 bg-[#070709]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="max-w-2xl">
            <span className="font-mono text-xs text-[#D4AF37] uppercase tracking-widest">
              [MATHEMATICAL RIGOR // ARCHITECTURAL SOLVERS]
            </span>
            <h2 className="font-syne text-3xl sm:text-4xl font-extrabold text-white mt-1">
              Sovereign Live Production Primitives
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Eliminating human estimation error with verified computational algorithms tuned for heavy structural loads and high-density gatherings.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Primitive 1 */}
            <div className="bg-[#10131E] p-8 rounded-2xl border border-[rgba(212,175,55,0.18)] hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between group shadow-xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded bg-[#181C28] font-mono text-xs text-[#D4AF37] border border-[#D4AF37]/20 font-bold">
                    PRIMITIVE 01 // CV-ENGINE
                  </span>
                  <span className="font-mono text-xs text-[#10B981]">&lt; 380ms RUNTIME</span>
                </div>
                <h3 className="font-syne text-xl font-bold text-white group-hover:text-[#D4AF37] transition-colors">
                  OpenCV Morphological Blueprint Vectorizer
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Converts raw architectural DWG, DXF, and raster heritage palace surveys into sub-millimeter 3D spatial coordinate maps. Extracts perimeter load-bearing pillars, ceiling hook limits, and subterranean conduit channels automatically.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between font-mono text-xs text-slate-400">
                <span>CALIPER PRECISION: <strong className="text-white">±0.5mm</strong></span>
                <span>FORMAT: <strong className="text-[#D4AF37]">DWG / DXF / OBJ</strong></span>
              </div>
            </div>

            {/* Primitive 2 */}
            <div className="bg-[#10131E] p-8 rounded-2xl border border-[rgba(212,175,55,0.18)] hover:border-[#10B981]/50 transition-all flex flex-col justify-between group shadow-xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded bg-[#181C28] font-mono text-xs text-[#10B981] border border-[#10B981]/20 font-bold">
                    PRIMITIVE 02 // LIFE SAFETY
                  </span>
                  <span className="font-mono text-xs text-[#10B981]">100% PASS RATE</span>
                </div>
                <h3 className="font-syne text-xl font-bold text-white group-hover:text-[#10B981] transition-colors">
                  NBC 2016 Part 4 Egress Simulation Engine
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Dynamic agent-based occupant flow modeling adhering strictly to the National Building Code 2016. Simulates multi-directional panic escape velocities (1.33 m/s), calculates staircase chokepoints, and validates corridor clear-widths with zero tolerance for stampede risks.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between font-mono text-xs text-slate-400">
                <span>FLOW RATE: <strong className="text-white">80 PERS/MIN/METER</strong></span>
                <span>AUDIT: <strong className="text-[#10B981]">ZERO FATALITY CERT</strong></span>
              </div>
            </div>

            {/* Primitive 3 */}
            <div className="bg-[#10131E] p-8 rounded-2xl border border-[rgba(212,175,55,0.18)] hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between group shadow-xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded bg-[#181C28] font-mono text-xs text-[#D4AF37] border border-[#D4AF37]/20 font-bold">
                    PRIMITIVE 03 // GEOMETRY
                  </span>
                  <span className="font-mono text-xs text-[#D4AF37]">SAT 2D SOLVER</span>
                </div>
                <h3 className="font-syne text-xl font-bold text-white group-hover:text-[#D4AF37] transition-colors">
                  SAT 2D Spatial Polygon Collision Detection
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Separating Axis Theorem polygon math executing continuously across all production elements. Flags overlaps between moving kinetic rigging, high-heat pyrotechnic clearance arcs, VIP furniture zones, and live camera crane sweeps.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between font-mono text-xs text-slate-400">
                <span>COLLISION TOLERANCE: <strong className="text-[#10B981]">0.00%</strong></span>
                <span>SAFETY BUFFER: <strong className="text-white">5.0M PYRO ARC</strong></span>
              </div>
            </div>

            {/* Primitive 4 */}
            <div className="bg-[#10131E] p-8 rounded-2xl border border-[rgba(212,175,55,0.18)] hover:border-[#10B981]/50 transition-all flex flex-col justify-between group shadow-xl">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-1 rounded bg-[#181C28] font-mono text-xs text-[#10B981] border border-[#10B981]/20 font-bold">
                    PRIMITIVE 04 // TENDERING
                  </span>
                  <span className="font-mono text-xs text-[#10B981]">TIER-1 SUPPLIERS</span>
                </div>
                <h3 className="font-syne text-xl font-bold text-white group-hover:text-[#10B981] transition-colors">
                  Reverse Auction Tender Matrix &amp; Equipment Verification
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                  Dynamic procurement system locking down certified d&amp;b audiotechnik KSL sound systems, Christie 4K laser projectors, and certified 100-ton hydraulic roof systems from top 1% global crews. Instant serial verification eliminates counterfeit rig components.
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between font-mono text-xs text-slate-400">
                <span>SAVINGS INDEX: <strong className="text-white">22.4% AVG</strong></span>
                <span>INVENTORY AUDIT: <strong className="text-[#10B981]">RFID / SERIAL VERIFIED</strong></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. In-Browser CAD Staging Viewport Mockup ───────────────────────── */}
      <section className="w-full px-6 lg:px-8 py-16 bg-[#09090C] border-y border-[rgba(212,175,55,0.16)]" id="cad-studio">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <span className="font-mono text-xs text-[#D4AF37] uppercase tracking-widest">
                [IN-BROWSER SPATIAL ENVIRONMENT]
              </span>
              <h2 className="font-syne text-3xl font-extrabold text-white mt-1">
                Live Web CAD Staging Viewport
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-[#121624] text-[#D4AF37] font-mono text-xs rounded border border-[#D4AF37]/30">
                VIEWPORT: X: 142.80m | Y: 88.50m | Z: 18.20m
              </span>
            </div>
          </div>

          {/* Main CAD Shell Container */}
          <div className="w-full bg-[#0D0E13] rounded-2xl border border-[rgba(212,175,55,0.25)] shadow-2xl overflow-hidden flex flex-col">
            {/* Viewport Header Toolbar */}
            <div className="px-6 py-3 bg-[#08090E] border-b border-[rgba(212,175,55,0.12)] flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Terminal className="h-4 w-4 text-[#D4AF37]" />
                <span className="font-mono text-xs uppercase text-white font-bold tracking-wider">
                  VENUE: JAIPUR ROYAL FORTRESS // MAIN CENTRAL COURTYARD
                </span>
                <span className="hidden sm:inline font-mono text-xs text-slate-500">DWG REV: 4.12</span>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-xs">
                {(["2D", "3D", "STRESS"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCadViewMode(mode)}
                    className={`px-3 py-1 rounded transition-all ${
                      cadViewMode === mode
                        ? "bg-[#D4AF37] text-black font-bold shadow"
                        : "bg-[#181C28] text-slate-300 hover:bg-[#202535]"
                    }`}
                  >
                    {mode === "2D" ? "TOP VIEW [2D]" : mode === "3D" ? "ISO PERSPECTIVE [3D]" : "STRESS MAP"}
                  </button>
                ))}
              </div>
            </div>

            {/* CAD Canvas Area */}
            <div className="relative w-full h-[500px] bg-[#07070A] overflow-hidden flex items-center justify-center p-6">
              {/* Background Coordinate Calipers Grid */}
              <div className="absolute inset-0 bg-[radial-gradient(rgba(212,175,55,0.15)_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"></div>

              <div className="absolute top-4 left-4 font-mono text-[10px] text-slate-500 select-none">
                00.00m ORIGIN [ELEVATION: +4.20m]
              </div>
              <div className="absolute bottom-4 right-4 font-mono text-[10px] text-[#D4AF37] select-none flex items-center gap-1.5">
                <span className="w-2 h-2 bg-[#10B981] rounded-full animate-ping"></span>
                COLLISION SOLVER: STABLE (0 VIOLATIONS)
              </div>

              {/* Synthetic Blueprint Staging Graphic */}
              <div className="relative w-full max-w-4xl h-full border border-[#D4AF37]/20 rounded-xl bg-gradient-to-b from-[#0A0A0F]/80 to-[#101017]/80 backdrop-blur-sm p-6 flex flex-col justify-between">
                {/* Stage Center Rig Object */}
                <div className="w-full flex items-center justify-between border-b border-[#D4AF37]/20 pb-4">
                  <div>
                    <span className="font-mono text-xs text-[#D4AF37] uppercase font-bold tracking-wider">
                      STAGE RIG IDENTIFIER: RIG-ALPHA-01
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      45.0m × 22.0m Hydraulic Modular Center Deck with 360° Rotational Ring
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-xs text-[#10B981] font-bold block">
                      LOAD: 82.4T / 120T MAX
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 block">
                      Safety Factor: 1.45 (Eurocode)
                    </span>
                  </div>
                </div>

                {/* Spatial Visual Schematic */}
                <div className="my-auto w-full grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  {/* Left: Stage Schematic */}
                  <div className="md:col-span-8 relative h-48 bg-[#090A0E] rounded-xl border border-[#D4AF37]/30 p-4 flex flex-col justify-between overflow-hidden">
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-[#D4AF37]/10 border border-[#D4AF37]/40 rounded text-[#D4AF37] font-mono text-[10px]">
                      TURNTABLE VELOCITY: 0.12 RAD/S
                    </div>

                    <div className="flex items-center gap-4 mt-2">
                      <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#D4AF37] flex items-center justify-center animate-spin" style={{ animationDuration: "20s" }}>
                        <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]"></span>
                      </div>
                      <div>
                        <span className="font-mono text-xs text-white font-bold uppercase block">
                          MAIN MONUMENTAL STAGE
                        </span>
                        <span className="text-xs text-slate-400 block mt-0.5">
                          d&amp;b KSL Arrays: Left/Right Flown at +14.5m
                        </span>
                        <span className="text-xs text-[#10B981] block mt-0.5 font-mono">
                          Acoustic Splinter: 104dB @ 25m Safe
                        </span>
                      </div>
                    </div>

                    {/* Crowd Egress Polygons Mock */}
                    <div className="grid grid-cols-3 gap-2 text-center font-mono text-[10px]">
                      <div className="bg-[#121624] p-1.5 rounded text-slate-300 border border-[#10B981]/30">
                        VIP CORRIDOR: 4.8M [CLEAR]
                      </div>
                      <div className="bg-[#121624] p-1.5 rounded text-slate-300 border border-[#10B981]/30">
                        CENTRAL ESCAPE: 6.2M [CLEAR]
                      </div>
                      <div className="bg-[#121624] p-1.5 rounded text-slate-300 border border-[#10B981]/30">
                        PRESS EGRESS: 3.8M [CLEAR]
                      </div>
                    </div>
                  </div>

                  {/* Right: Live Acoustic HUD Meter */}
                  <div className="md:col-span-4 bg-[#080A10] p-4 rounded-xl border border-[rgba(212,175,55,0.2)] space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-[10px] text-slate-400 uppercase">Decibel Boundary</span>
                      <span className="font-mono text-[10px] text-[#10B981] font-bold">ISO 1996 LIMIT</span>
                    </div>

                    <div className="flex items-baseline justify-between">
                      <span className="font-syne text-2xl text-[#D4AF37] font-extrabold">102.4 dB</span>
                      <span className="font-mono text-xs text-slate-400">LAeq (15 MIN)</span>
                    </div>

                    {/* Decibel Level Bar */}
                    <div className="w-full bg-[#181C28] h-2.5 rounded-full overflow-hidden flex">
                      <div className="bg-[#10B981] h-full" style={{ width: "78%" }}></div>
                      <div className="bg-[#D4AF37] h-full" style={{ width: "14%" }}></div>
                      <div className="bg-[#EF4444] h-full" style={{ width: "8%" }}></div>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                      <span>80 dB</span>
                      <span>95 dB</span>
                      <span className="text-[#EF4444]">110 dB CEIL</span>
                    </div>

                    <div className="pt-2 border-t border-white/10 text-xs text-slate-400">
                      Historic Facade Vibration: <strong className="text-white font-mono">0.22 mm/s</strong> (Well below 3.0 mm/s damage threshold).
                    </div>
                  </div>
                </div>

                {/* Viewport Bottom Status Bar */}
                <div className="w-full flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10 font-mono text-[11px]">
                  <div className="flex items-center gap-4 text-slate-400">
                    <span>WIND SPEED: <strong className="text-white">14.2 KM/H (GUST: 22 KM/H)</strong></span>
                    <span>BALLAST TANK: <strong className="text-[#10B981]">42,000 L WATER LOCKED</strong></span>
                  </div>
                  <div className="text-[#D4AF37] font-bold">
                    ESCROW PHASE 2 LOCK: VERIFIED BY DRONE PHOTOGRAMMETRY
                  </div>
                </div>
              </div>
            </div>

            {/* Viewport Footer Meta */}
            <div className="px-6 py-3 bg-[#08090E] border-t border-white/10 flex items-center justify-between font-mono text-xs">
              <span className="text-slate-400">COORDINATE MESH: WGS-84 REPROJECTION</span>
              <Link
                href="/app"
                className="inline-flex items-center gap-1.5 text-[#D4AF37] font-bold hover:underline"
              >
                <span>Launch Fullscreen CAD Studio</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Pre-Engineered Monumental Palaces & Arenas ───────────────────── */}
      <section className="w-full px-6 lg:px-8 py-20 bg-[#070709]" id="palaces">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="max-w-2xl">
              <span className="font-mono text-xs text-[#D4AF37] uppercase tracking-widest">
                [SOVEREIGN VENUE REPOSITORIES]
              </span>
              <h2 className="font-syne text-3xl sm:text-4xl font-extrabold text-white mt-1">
                Pre-Engineered Monumental Palaces &amp; Arenas
              </h2>
              <p className="text-sm text-slate-400 mt-2">
                Every location features millimeter-accurate CAD scans, validated electrical substation capacity, acoustic shadow calculations, and local authority pre-clearance.
              </p>
            </div>
            <Link
              href="/venues"
              className="font-mono text-xs text-[#D4AF37] uppercase tracking-wider flex items-center gap-1.5 hover:underline"
            >
              <span>View All 42 Global Portals</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Palace Card 1 (Jaipur) */}
            <div className="bg-[#10131E] rounded-2xl overflow-hidden border border-[rgba(212,175,55,0.2)] hover:border-[#D4AF37] transition-all flex flex-col justify-between group shadow-xl">
              <div>
                <div className="relative w-full h-64 overflow-hidden bg-slate-900">
                  <img
                    src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800&auto=format&fit=crop"
                    alt="Rambagh Imperial Palace & Central Courtyard Jaipur"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-[#09090C]/80 backdrop-blur-md rounded border border-[#D4AF37]/40 font-mono text-[10px] text-[#D4AF37]">
                    JAIPUR, INDIA
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                    <span className="font-mono text-[10px] text-[#10B981] bg-[#07070A]/90 px-2 py-0.5 rounded border border-[#10B981]/30">
                      HERITAGE GRADE-1
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="font-syne text-lg font-bold text-white group-hover:text-[#D4AF37] transition-colors">
                      Rambagh Imperial Palace &amp; Courtyard
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Monolithic marble courtyard flanked by Rajput arches. Equipped with subterranean acoustic damping channels and custom soft-anchor rigging points.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-3 border-y border-white/10 font-mono text-[11px]">
                    <div className="text-slate-400">CAPACITY: <strong className="text-white">8,500 VIP</strong></div>
                    <div className="text-slate-400">POWER: <strong className="text-[#D4AF37]">1,500 kVA SUB</strong></div>
                    <div className="text-slate-400">CURFEW: <strong className="text-white">01:00 AM</strong></div>
                    <div className="text-slate-400">EGRESS: <strong className="text-[#10B981]">12 PORTALS</strong></div>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0">
                <Link
                  href="/app"
                  className="w-full block text-center py-2.5 bg-[#181C28] hover:bg-[#D4AF37] hover:text-black text-[#D4AF37] font-mono text-xs uppercase tracking-wider rounded-lg border border-[#D4AF37]/30 transition-all font-semibold"
                >
                  Initialize CAD Spatial Session
                </Link>
              </div>
            </div>

            {/* Arena Card 2 (Dubai) */}
            <div className="bg-[#10131E] rounded-2xl overflow-hidden border border-[rgba(212,175,55,0.2)] hover:border-[#D4AF37] transition-all flex flex-col justify-between group shadow-xl">
              <div>
                <div className="relative w-full h-64 overflow-hidden bg-slate-900">
                  <img
                    src="https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=800&auto=format&fit=crop"
                    alt="The Waterfront Mega-Arena Dubai"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-[#09090C]/80 backdrop-blur-md rounded border border-[#D4AF37]/40 font-mono text-[10px] text-[#D4AF37]">
                    DUBAI, UAE
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                    <span className="font-mono text-[10px] text-[#10B981] bg-[#07070A]/90 px-2 py-0.5 rounded border border-[#10B981]/30">
                      MARINE LOGISTICS DOCK
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="font-syne text-lg font-bold text-white group-hover:text-[#D4AF37] transition-colors">
                      The Waterfront Mega-Arena &amp; Port
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      State-of-the-art tensile steel arena engineered for super-heavy stadium rigs, drone light show corridors, and unshielded marine acoustic projection.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-3 border-y border-white/10 font-mono text-[11px]">
                    <div className="text-slate-400">CAPACITY: <strong className="text-white">22,000 PEAK</strong></div>
                    <div className="text-slate-400">POWER: <strong className="text-[#D4AF37]">3,200 kVA REDUNDANT</strong></div>
                    <div className="text-slate-400">CURFEW: <strong className="text-[#10B981]">24/7 SHIELDED</strong></div>
                    <div className="text-slate-400">CRANE DOCK: <strong className="text-white">50T BERTH</strong></div>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0">
                <Link
                  href="/app"
                  className="w-full block text-center py-2.5 bg-[#181C28] hover:bg-[#D4AF37] hover:text-black text-[#D4AF37] font-mono text-xs uppercase tracking-wider rounded-lg border border-[#D4AF37]/30 transition-all font-semibold"
                >
                  Initialize CAD Spatial Session
                </Link>
              </div>
            </div>

            {/* Hall Card 3 (London) */}
            <div className="bg-[#10131E] rounded-2xl overflow-hidden border border-[rgba(212,175,55,0.2)] hover:border-[#D4AF37] transition-all flex flex-col justify-between group shadow-xl">
              <div>
                <div className="relative w-full h-64 overflow-hidden bg-slate-900">
                  <img
                    src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop"
                    alt="The Neoclassical Grand Hall Westminster London"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-3 left-3 px-2.5 py-1 bg-[#09090C]/80 backdrop-blur-md rounded border border-[#D4AF37]/40 font-mono text-[10px] text-[#D4AF37]">
                    LONDON, UK
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                    <span className="font-mono text-[10px] text-[#10B981] bg-[#07070A]/90 px-2 py-0.5 rounded border border-[#10B981]/30">
                      HISTORIC RIGGING RATED
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div>
                    <h3 className="font-syne text-lg font-bold text-white group-hover:text-[#D4AF37] transition-colors">
                      The Neoclassical Grand Hall &amp; Rotunda
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Grade-1 listed historic dome engineered with non-invasive beam clamps, zero-resonance chamber acoustic curtains, and dedicated broadcast fiber nodes.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 py-3 border-y border-white/10 font-mono text-[11px]">
                    <div className="text-slate-400">CAPACITY: <strong className="text-white">4,200 THEATRE</strong></div>
                    <div className="text-slate-400">POWER: <strong className="text-[#D4AF37]">950 kVA CLEAN FEED</strong></div>
                    <div className="text-slate-400">CURFEW: <strong className="text-white">23:00 SOUND</strong></div>
                    <div className="text-slate-400">BROADCAST: <strong className="text-[#10B981]">10 Gbps SYMMETRIC</strong></div>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0">
                <Link
                  href="/app"
                  className="w-full block text-center py-2.5 bg-[#181C28] hover:bg-[#D4AF37] hover:text-black text-[#D4AF37] font-mono text-xs uppercase tracking-wider rounded-lg border border-[#D4AF37]/30 transition-all font-semibold"
                >
                  Initialize CAD Spatial Session
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Tri-Phase Deterministic Escrow Vault ────────────────────────── */}
      <section className="w-full px-6 lg:px-8 py-20 bg-[#0A0A0D] border-t border-[rgba(212,175,55,0.15)]">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="max-w-2xl">
            <span className="font-mono text-xs text-[#D4AF37] uppercase tracking-widest">
              [INSTITUTIONAL CAPITAL CUSTODY]
            </span>
            <h2 className="font-syne text-3xl sm:text-4xl font-extrabold text-white mt-1">
              Tri-Phase Deterministic Escrow Vault
            </h2>
            <p className="text-sm text-slate-400 mt-2">
              Never pay blindly upfront. Capital is locked in regulatory compliant escrow and disbursed strictly upon algorithmic verification of rigging safety, delivery telemetry, and live execution.
            </p>
          </div>

          <div className="bg-[#10131E] p-8 sm:p-10 rounded-2xl border border-[rgba(212,175,55,0.2)] space-y-8 shadow-2xl">
            {/* Budget Slider Control */}
            <div className="space-y-3">
              <div className="flex justify-between items-baseline">
                <label className="font-mono text-xs text-slate-300 uppercase">
                  Select Production Capital Envelope
                </label>
                <span className="font-syne text-2xl sm:text-3xl text-[#D4AF37] font-extrabold">
                  {formatEscrowDisplay(escrowLakhs)}
                </span>
              </div>
              <input
                type="range"
                min="50"
                max="2500"
                step="50"
                value={escrowLakhs}
                onChange={(e) => setEscrowLakhs(Number(e.target.value))}
                className="w-full h-2.5 bg-[#181C28] rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
              />
              <div className="flex justify-between text-slate-500 font-mono text-xs">
                <span>₹50 LAKHS (TIER 3)</span>
                <span>₹5.0 CRORES (GLOBAL ARENA)</span>
                <span>₹25.0 CRORES (SOVEREIGN SUMMIT)</span>
              </div>
            </div>

            {/* 3-Phase Milestone Visual Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              {/* Phase 1 */}
              <div className="p-6 bg-[#0E1119] rounded-xl border border-white/10 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-[#D4AF37] font-bold uppercase">
                    PHASE 01 // ADVANCE
                  </span>
                  <span className="font-syne text-xl text-[#D4AF37] font-bold">25%</span>
                </div>
                <div className="font-mono text-2xl text-white font-bold">
                  {formatPhaseAmount(escrowLakhs * 0.25)}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Locked for venue reservation, structural CAD blueprint sign-off, and hardware procurement down-payments.
                </p>
                <div className="pt-2 border-t border-white/10 text-[#10B981] font-mono text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>PE Engineering Stamp Required</span>
                </div>
              </div>

              {/* Phase 2 */}
              <div className="p-6 bg-[#0E1119] rounded-xl border border-[#D4AF37]/40 space-y-2 shadow-lg">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-[#10B981] font-bold uppercase">
                    PHASE 02 // MID-SHOW
                  </span>
                  <span className="font-syne text-xl text-[#10B981] font-bold">50%</span>
                </div>
                <div className="font-mono text-2xl text-white font-bold">
                  {formatPhaseAmount(escrowLakhs * 0.50)}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Released on-site once truss rig structural tension passes laser sensors and initial audio soundcheck confirms ISO compliance.
                </p>
                <div className="pt-2 border-t border-white/10 text-[#10B981] font-mono text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Drone Photogrammetry Sign-Off</span>
                </div>
              </div>

              {/* Phase 3 */}
              <div className="p-6 bg-[#0E1119] rounded-xl border border-white/10 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-xs text-slate-400 font-bold uppercase">
                    PHASE 03 // STRIKE
                  </span>
                  <span className="font-syne text-xl text-[#D4AF37] font-bold">25%</span>
                </div>
                <div className="font-mono text-2xl text-white font-bold">
                  {formatPhaseAmount(escrowLakhs * 0.25)}
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Final reconciliation released after zero-fatality verification, clean site handover, and damage bond clearance.
                </p>
                <div className="pt-2 border-t border-white/10 text-slate-400 font-mono text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#D4AF37]" />
                  <span>Zero Venue Indemnity Claims</span>
                </div>
              </div>
            </div>

            {/* Escrow Guarantees Bar */}
            <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-4 font-mono text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#D4AF37]" />
                <span className="text-[#D4AF37] font-bold uppercase">
                  RBI Escrow Compliant Trustee Bank Accounts
                </span>
                <span>•</span>
                <span>Smart Contract Escrow Audit: Hash #8f32c...9e10</span>
              </div>
              <div className="text-[#10B981]">
                DISBURSEMENT LATENCY: IMMEDIATE RTGS / SEPA
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. Institutional Trust & Call To Action Strip ───────────────────── */}
      <section className="w-full px-6 lg:px-8 py-20 bg-[#070709] border-t border-[rgba(212,175,55,0.2)]">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-2 max-w-2xl">
            <span className="font-mono text-xs text-[#10B981] uppercase tracking-widest">
              [STAGE DIRECTORS // RISK MITIGATION]
            </span>
            <h2 className="font-syne text-3xl sm:text-4xl font-extrabold text-white">
              Deploy Deterministic Live Staging Infrastructure
            </h2>
            <p className="text-sm text-slate-400">
              Backed by ₹100 Crore Global Production Indemnity underwriting and 24/7 Rapid Response Disaster Management Teams deployed across Zurich, Singapore, London, Dubai, and Raipur.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <Link
              href="/contact"
              className="px-8 py-4 bg-gradient-to-r from-[#D4AF37] to-[#AA820A] text-black font-mono text-xs font-bold uppercase tracking-wider rounded-xl border border-[#D4AF37] shadow-lg hover:brightness-110 transition-all"
            >
              Schedule Technical Walkthrough
            </Link>
            <Link
              href="/app"
              className="px-6 py-4 bg-[#10131E] text-white font-mono text-xs uppercase tracking-wider rounded-xl border border-[rgba(212,175,55,0.25)] hover:border-[#D4AF37] transition-all"
            >
              Open Web App Studio
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
