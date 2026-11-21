import Link from "next/link";
import { Lock, ShieldCheck, CheckCircle2, ArrowRight, Clock, AlertCircle } from "lucide-react";

export default function EscrowPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.eventology.in";

  return (
    <div className="py-12 md:py-20 px-6 lg:px-8 space-y-20 max-w-7xl mx-auto">
      {/* Header */}
      <div className="max-w-3xl">
        <span className="rounded-md bg-[#10B981]/15 px-3 py-1 text-xs font-bold tracking-widest text-[#10B981] border border-[#10B981]/30 uppercase">
          Institutional Financial Security
        </span>
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mt-4">
          25 / 50 / 25 Milestone Escrow Protection
        </h1>
        <p className="mt-4 text-base sm:text-lg text-slate-400 leading-relaxed">
          India's first double-entry milestone escrow ledger designed specifically for the live events and wedding production industry.
          Eliminating non-performance risks for clients and late payment defaults for contractors.
        </p>
      </div>

      {/* 3 Milestone Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Milestone 1 */}
        <div className="rounded-3xl border border-white/10 bg-[#10131E] p-8 space-y-4 flex flex-col justify-between">
          <div>
            <div className="text-4xl font-black text-[#FFD700]">25%</div>
            <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mt-1">
              Milestone 1 • Mobilization Advance
            </div>
            <h2 className="text-xl font-bold text-white mt-4">Contract Execution Release</h2>
            <p className="text-sm text-slate-400 leading-relaxed mt-2">
              Released directly to the vendor's verified bank account upon mutual contract execution. Funds transport fleet mobilization, crew reservations, and procurement of consumables.
            </p>
          </div>
          <div className="rounded-xl bg-white/5 p-3.5 border border-white/5 text-xs text-slate-300 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#FFD700] shrink-0" />
            <span>Trigger: Mutual contract signing + KYC check</span>
          </div>
        </div>

        {/* Milestone 2 */}
        <div className="rounded-3xl border border-[#10B981]/30 bg-[#10131E] p-8 space-y-4 flex flex-col justify-between shadow-lg">
          <div>
            <div className="text-4xl font-black text-[#10B981]">50%</div>
            <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mt-1">
              Milestone 2 • Technical Handover
            </div>
            <h2 className="text-xl font-bold text-white mt-4">Dock Arrival & Soundcheck Signoff</h2>
            <p className="text-sm text-slate-400 leading-relaxed mt-2">
              Released when equipment transport trucks pass loading dock QR-code gate scan, physical gear matches the signed BOM specification, and initial audio soundcheck / lighting focus is certified.
            </p>
          </div>
          <div className="rounded-xl bg-[#10B981]/10 p-3.5 border border-[#10B981]/20 text-xs text-[#10B981] flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span>Trigger: Loading Dock QR scan + Soundcheck pass</span>
          </div>
        </div>

        {/* Milestone 3 */}
        <div className="rounded-3xl border border-white/10 bg-[#10131E] p-8 space-y-4 flex flex-col justify-between">
          <div>
            <div className="text-4xl font-black text-[#3B82F6]">25%</div>
            <div className="text-xs font-bold tracking-widest text-slate-400 uppercase mt-1">
              Milestone 3 • Final Settlement
            </div>
            <h2 className="text-xl font-bold text-white mt-4">Event Strike Signoff</h2>
            <p className="text-sm text-slate-400 leading-relaxed mt-2">
              Disbursed upon completion of event strike and site handover. Automatically settled within 48 hours post-event in the absence of an active client grievance dispute.
            </p>
          </div>
          <div className="rounded-xl bg-white/5 p-3.5 border border-white/5 text-xs text-slate-300 flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#3B82F6] shrink-0" />
            <span>Trigger: Event Strike complete or 48h auto-release</span>
          </div>
        </div>
      </div>

      {/* Dispute Resolution Section */}
      <div className="rounded-3xl border border-white/10 bg-[#141824] p-8 md:p-12 space-y-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-[#FFD700]" />
          <h2 className="text-2xl font-bold text-white">Dispute & Grievance Governance</h2>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed max-w-3xl">
          If a technical failure occurs (e.g. line-array sound failure, missing generator backup), the client can raise a dispute in the Live Cockpit.
          The milestone payment is automatically frozen in escrow, and an Eventology technical arbitrator reviews the time-stamped cue logs within 2 hours.
        </p>
      </div>
    </div>
  );
}
