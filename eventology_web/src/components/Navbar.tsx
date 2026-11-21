"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, ShieldCheck, MapPin, ArrowUpRight, Menu, X } from "lucide-react";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.eventology.in";

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#070709]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#FFD700] to-[#B8860B] shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-transform group-hover:scale-105">
            <Building2 className="h-5 w-5 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black tracking-[0.15em] text-white">
                EVENTOLOGY
              </span>
              <span className="rounded bg-[#FFD700]/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-[#FFD700] border border-[#FFD700]/30">
                PRO
              </span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">
              Deterministic Event Platform
            </p>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2">
          <Link
            href="/"
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Explore
          </Link>
          <Link
            href="/venues"
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Venues & Palaces
          </Link>
          <Link
            href="/vendors"
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Production Crews
          </Link>
          <Link
            href="/technology"
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Deep-Tech & Safety
          </Link>
          <Link
            href="/escrow"
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Milestone Escrow
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
            <MapPin className="h-3.5 w-3.5 text-[#FFD700]" />
            <span className="font-semibold text-white">Raipur, India</span>
          </div>

          <a
            href={`${appUrl}/become-vendor`}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
          >
            Partner With Us
          </a>

          <a
            href={appUrl}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#E6B800] px-4.5 py-2 text-sm font-bold text-black shadow-[0_0_20px_rgba(255,215,0,0.25)] hover:brightness-110 transition-all"
          >
            <span>Launch Studio</span>
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        {/* Mobile Hamburger */}
        <div className="flex md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-lg p-2 text-slate-400 hover:text-white"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/10 bg-[#070709] px-6 py-6 space-y-4">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-slate-300 hover:text-white"
          >
            Explore
          </Link>
          <Link
            href="/venues"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-slate-300 hover:text-white"
          >
            Venues & Palaces
          </Link>
          <Link
            href="/vendors"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-slate-300 hover:text-white"
          >
            Production Crews
          </Link>
          <Link
            href="/technology"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-slate-300 hover:text-white"
          >
            Deep-Tech & Safety
          </Link>
          <Link
            href="/escrow"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-base font-medium text-slate-300 hover:text-white"
          >
            Milestone Escrow
          </Link>
          <div className="pt-4 border-t border-white/10 space-y-3">
            <a
              href={`${appUrl}/become-vendor`}
              className="block w-full text-center rounded-lg border border-white/15 py-2.5 text-sm font-medium text-white"
            >
              Partner With Us
            </a>
            <a
              href={appUrl}
              className="block w-full text-center rounded-lg bg-[#FFD700] py-2.5 text-sm font-bold text-black"
            >
              Launch Event Studio
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
