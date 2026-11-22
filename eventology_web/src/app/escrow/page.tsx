"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, ShieldCheck, CheckCircle2, ArrowRight, Clock, AlertCircle, Calculator, ChevronRight } from "lucide-react";

export default function EscrowPage() {
  const [budgetLakhs, setBudgetLakhs] = useState(25); // In Lakhs ₹

  const totalPaise = budgetLakhs * 100000;
  const milestone1 = Math.round(totalPaise * 0.25);
  const milestone2 = Math.round(totalPaise * 0.50);
  const milestone3 = Math.round(totalPaise * 0.25);

  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

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
          India&apos;s first double-entry milestone escrow ledger designed specifically for the live events and wedding production industry.
          Eliminating non-performance risks for clients and late payment defaults for contractors.
        </p>
      </div>

      {/* ── Interactive Escrow Milestone Simulator ─────────────────────────── */}
      <div className="rounded-3xl border border-[#10B981]/30 bg-gradient-to-br from-[#121624] via-[#0E121E] to-[#121624] p-8 md:p-12 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#10B981] uppercase tracking-wider">
              <Calculator className="h-4 w-4" />
              <span>Interactive Escrow Simulator</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Calculate Your Milestone Disbursements
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Move the slider to see how funds are cryptographically locked and disbursed in stages.
            </p>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-400 uppercase font-bold tracking-wider">
              Simulated Production Budget
            </div>
            <div className="text-3xl font-black text-[#FFD700]">
              {formatINR(totalPaise)}
            </div>
            <div className="text-xs text-slate-500 font-mono">
              ({budgetLakhs} Lakhs INR)
            </div>
          </div>
        </div>

        {/* Slider */}
        <div className="mt-8 space-y-3">
          <div className="flex justify-between text-xs text-slate-400 font-medium">
            <span>₹5,00,000 (Small Hall)</span>
            <span>₹50,00,000 (Grand Palace)</span>
            <span>₹2,00,00,000+ (Mega Festival)</span>
          </div>
          <input
            type="range"
            min="5"
            max="200"
            step="5"
            value={budgetLakhs}
            onChange={(e) => setBudgetLakhs(Number(e.target.value))}
            className="w-full h-2.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-[#10B981]"
          />
        </div>

        {/* 3 Calculated Milestone Cards */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFD700]">
              Milestone 1 • 25% Advance
            </span>
            <div className="text-2xl font-black text-white">
              {formatINR(milestone1)}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Disbursed on mutual contract signing to fund transportation fleet and team logistics.
            </p>
            <div className="pt-2 text-[11px] font-mono text-slate-500">
              Trigger: KYC verification + digital e-sign
            </div>
          </div>

          <div className="rounded-2xl border border-[#10B981]/40 bg-[#10B981]/5 p-6 space-y-3 shadow-lg">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#10B981]">
              Milestone 2 • 50% Soundcheck
            </span>
            <div className="text-2xl font-black text-[#10B981]">
              {formatINR(milestone2)}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Disbursed when equipment trucks pass loading dock QR scan and soundcheck is certified.
            </p>
            <div className="pt-2 text-[11px] font-mono text-[#10B981]/80 font-semibold">
              Trigger: Loading dock arrival + audio signoff
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#3B82F6]">
              Milestone 3 • 25% Strike
            </span>
            <div className="text-2xl font-black text-white">
              {formatINR(milestone3)}
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Disbursed upon clean venue strike and handover, or automated 48-hour release.
            </p>
            <div className="pt-2 text-[11px] font-mono text-slate-500">
              Trigger: Stage strike completion
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-[#10B981]" />
            <span>Escrow accounts held with RBI-regulated scheduled commercial banks.</span>
          </div>

          <Link
            href="/app"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#10B981] to-[#059669] px-6 py-2.5 text-xs font-bold text-white shadow-lg hover:brightness-110 transition-all"
          >
            <span>Deploy Escrow Contract in Web App</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* 3 Milestone Breakdown Details */}
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
              Released directly to the vendor&apos;s verified bank account upon mutual contract execution. Funds transport fleet mobilization, crew reservations, and procurement of consumables.
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
        <div className="pt-2">
          <Link
            href="/app"
            className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/15 px-5 py-2.5 text-xs font-bold text-white transition-all"
          >
            <span>Open Trust Governance in Web App</span>
            <ArrowRight className="h-3.5 w-3.5 text-[#FFD700]" />
          </Link>
        </div>
      </div>
    </div>
  );
}
