"use client";

import { useState } from "react";
import Link from "next/link";
import { Sliders, DoorOpen, Speaker, Shield, CheckCircle, ArrowRight } from "lucide-react";

export default function ScaleEstimator() {
  const [guests, setGuests] = useState(350);

  // NBC 2016 Part 4 standards: 1.5 sq.m per occupant in banquet/assembly
  const reqSqMeters = Math.round(guests * 1.5);
  const reqSqFeet = Math.round(reqSqMeters * 10.764);

  // Exit door unit capacity: 50 occupants per unit width (0.5m)
  const exitUnits = Math.ceil(guests / 50.0);
  const minExitWidthMeters = (exitUnits * 0.5).toFixed(1);

  // Audio power estimation: ~15W RMS per occupant for concert grade line-array
  const audioKW = (guests * 0.015).toFixed(1);

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#10131E] to-[#0A0D14] p-8 md:p-12 shadow-2xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="rounded-md bg-[#FFD700]/15 px-2.5 py-1 text-xs font-bold tracking-wider text-[#FFD700] border border-[#FFD700]/30 font-mono">
              REAL-TIME LOGISTICS & SAFETY ESTIMATOR
            </span>
            <span className="rounded-md bg-[#10B981]/15 px-2.5 py-1 text-xs font-bold tracking-wider text-[#10B981] border border-[#10B981]/30 font-mono">
              NBC 2016 FORMULA
            </span>
          </div>
          <h2 className="font-syne text-2xl md:text-3xl font-extrabold text-white tracking-tight">
            Deterministic Scale & Fire Safety Proofs
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Slide guest attendance to calculate mathematical floor area, emergency exit door requirements, and power specs for Eventalogy International productions.
          </p>
        </div>

        <Link
          href="/app"
          className="self-start md:self-auto flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15 border border-white/15 transition-all font-mono text-xs uppercase"
        >
          <span>Open Web Studio</span>
          <ArrowRight className="h-4 w-4 text-[#FFD700]" />
        </Link>
      </div>

      {/* Interactive Slider */}
      <div className="py-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl md:text-5xl font-black text-[#FFD700] tracking-tight">
              {guests.toLocaleString()}
            </span>
            <span className="text-lg font-bold text-slate-300">Target Guests</span>
          </div>
          <span className="text-xs font-mono text-slate-400">Range: 50 – 2,000 Pax</span>
        </div>

        <input
          type="range"
          min="50"
          max="2000"
          step="25"
          value={guests}
          onChange={(e) => setGuests(Number(e.target.value))}
          className="w-full h-2.5 bg-[#1F2637] rounded-lg appearance-none cursor-pointer accent-[#FFD700]"
        />
      </div>

      {/* Dynamic Results Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
        {/* Metric 1 */}
        <div className="rounded-2xl border border-white/5 bg-[#141824] p-5">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
            <Sliders className="h-4 w-4 text-[#FFD700]" />
            <span>Floor Area Required</span>
          </div>
          <div className="mt-3 text-xl font-bold text-white">
            {reqSqFeet.toLocaleString()} sq.ft
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {reqSqMeters.toLocaleString()} m² (1.5 m²/p standard)
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl border border-white/5 bg-[#141824] p-5">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
            <DoorOpen className="h-4 w-4 text-[#10B981]" />
            <span>Aggregate Exit Width</span>
          </div>
          <div className="mt-3 text-xl font-bold text-white">
            {minExitWidthMeters} meters
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {exitUnits} fire exit door units (0.5m/unit)
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-2xl border border-white/5 bg-[#141824] p-5">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
            <Speaker className="h-4 w-4 text-[#3B82F6]" />
            <span>Concert Audio PA Rig</span>
          </div>
          <div className="mt-3 text-xl font-bold text-white">
            {audioKW} kW RMS
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Linear array inverse-square coverage
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-2xl border border-white/5 bg-[#141824] p-5">
          <div className="flex items-center gap-2 text-xs font-bold tracking-wider text-slate-400 uppercase">
            <Shield className="h-4 w-4 text-[#FFD700]" />
            <span>Milestone Escrow</span>
          </div>
          <div className="mt-3 text-xl font-bold text-white">
            25% • 50% • 25%
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Contract • Soundcheck QR • Strike
          </div>
        </div>
      </div>
    </section>
  );
}
