import Link from "next/link";
import {
  FileCode2,
  ShieldCheck,
  Cpu,
  Layers,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Scale,
} from "lucide-react";

export default function TechnologyPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.eventology.in";

  return (
    <div className="py-12 md:py-20 px-6 lg:px-8 space-y-20 max-w-7xl mx-auto">
      {/* Header */}
      <div className="max-w-3xl">
        <span className="rounded-md bg-[#FFD700]/15 px-3 py-1 text-xs font-bold tracking-widest text-[#FFD700] border border-[#FFD700]/30 uppercase">
          Proprietary Engineering Architecture
        </span>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mt-4">
          Deterministic Mathematical Solvers & Life-Safety Proofs
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-400 leading-relaxed">
          Eventology eliminates conversational AI theater. In its place, our platform operates on rigorous
          computational geometry, National Building Code (NBC 2016 Part 4) egress equations, and automated
          cryptographic reverse auctions.
        </p>
      </div>

      {/* 4 Pillars Deep-Dive */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Pillar 1 */}
        <div className="rounded-3xl border border-white/10 bg-[#10131E] p-8 md:p-10 space-y-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFD700]/15 text-[#FFD700]">
            <FileCode2 className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            1. OpenCV Morphological Blueprint Vectorizer
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Our computer vision pipeline ingests architectural scans, blueprint PDFs, and satellite site plans. Using
            Canny edge detection and probabilistic Hough line transforms, it segments:
          </p>
          <ul className="space-y-2 text-sm text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#10B981] mt-0.5 shrink-0" />
              <span>Outer structural perimeter contours and load-bearing pillars</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#10B981] mt-0.5 shrink-0" />
              <span>Doorway and fire egress openings with physical pixel-to-meter scaling</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#10B981] mt-0.5 shrink-0" />
              <span>Direct synthesis of standardized XML diagrams for Draw.io and AutoCAD DXF</span>
            </li>
          </ul>
        </div>

        {/* Pillar 2 */}
        <div className="rounded-3xl border border-white/10 bg-[#10131E] p-8 md:p-10 space-y-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#10B981]/15 text-[#10B981]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            2. NBC 2016 Part 4 Life-Safety Egress Inspector
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Every proposed stage layout and guest seating configuration is evaluated against the National Building Code
            of India (NBC 2016 Part 4 - Fire & Life Safety):
          </p>
          <div className="rounded-2xl bg-black/40 p-4 border border-white/5 font-mono text-xs text-slate-300 space-y-2">
            <div>• Occupant Load = Net Usable Floor Area / 1.5 m² per person</div>
            <div>• Required Exit Units = Total Occupancy / 50 persons per unit width (0.5m)</div>
            <div>• Maximum Travel Distance ≤ 30.0 meters from any point to nearest exit</div>
            <div>• Diagonal Remoteness Rule ≥ 50% of hall diagonal</div>
          </div>
        </div>

        {/* Pillar 3 */}
        <div className="rounded-3xl border border-white/10 bg-[#10131E] p-8 md:p-10 space-y-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3B82F6]/15 text-[#3B82F6]">
            <Cpu className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            3. SAT 2D Spatial Polygon Collision Detection
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Separating Axis Theorem (SAT) spatial algorithms evaluate convex and concave polygon boundaries for all
            production equipment. Prevents physical stage clearance clashes, FOH audio console sightline obstruction,
            and guest thoroughfare bottlenecks.
          </p>
        </div>

        {/* Pillar 4 */}
        <div className="rounded-3xl border border-white/10 bg-[#10131E] p-8 md:p-10 space-y-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFD700]/15 text-[#FFD700]">
            <Scale className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">
            4. Multi-Factor Reverse Auction Scoring
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Deterministic scoring ranking bids submitted by vetted technical contractors:
          </p>
          <div className="rounded-2xl bg-black/40 p-4 border border-white/5 font-mono text-xs text-slate-300">
            Score = (0.40 × Price) + (0.30 × SpecMatch) + (0.20 × Rating) + (0.10 × Proximity)
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Calculated in integer Paise to eradicate floating point rounding errors across large multi-crore budgets.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-3xl border border-white/10 bg-[#141824] p-8 md:p-12 text-center space-y-4">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
          Experience the Production Studio in Action
        </h2>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Upload your venue blueprint scan or start an event specification to generate instant engineering proofs.
        </p>
        <div className="pt-2">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-xl bg-[#FFD700] px-6 py-3.5 text-sm font-bold text-black hover:brightness-110 transition-all shadow-[0_0_25px_rgba(255,215,0,0.3)]"
          >
            <span>Launch Web Studio CAD</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
