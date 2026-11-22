"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Menu, X, Shield, Terminal, Globe, UserCheck } from "lucide-react";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[rgba(212,175,55,0.18)] bg-[#070709]/90 backdrop-blur-xl shadow-[0_16px_32px_rgba(0,0,0,0.8)]">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3.5 group">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] via-[#AA820A] to-[#604403] border border-[#FFD700]/40 shadow-[0_0_25px_rgba(212,175,55,0.3)] transition-transform group-hover:scale-105">
            <Shield className="h-6 w-6 text-black" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-syne text-lg sm:text-xl font-extrabold tracking-wider text-white">
                EVENTALOGY
              </span>
              <span className="font-syne text-xs font-bold tracking-widest text-[#D4AF37] uppercase">
                INTERNATIONAL
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 rounded bg-[#10B981]/15 px-2 py-0.5 text-[9px] font-mono font-bold tracking-wider text-[#10B981] border border-[#10B981]/30">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-pulse"></span>
                PRO v4.8
              </span>
            </div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
              Sovereign Staging &amp; Spatial Architecture
            </p>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2 font-mono text-xs uppercase tracking-wider">
          <Link
            href="/"
            className="rounded-lg px-3 py-2 font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Explore
          </Link>
          <Link
            href="/venues"
            className="rounded-lg px-3 py-2 font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Global Palaces
          </Link>
          <Link
            href="/vendors"
            className="rounded-lg px-3 py-2 font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Production Crews
          </Link>
          <Link
            href="/technology"
            className="rounded-lg px-3 py-2 font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Deep-Tech
          </Link>
          <Link
            href="/escrow"
            className="rounded-lg px-3 py-2 font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Escrow Vault
          </Link>
          <Link
            href="/contact"
            className="rounded-lg px-3 py-2 font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Dispatch
          </Link>
          <Link
            href="/app"
            className="flex items-center gap-1.5 rounded-lg border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-bold text-[#FFD700] hover:bg-[#D4AF37]/20 transition-all ml-1 shadow-[0_0_15px_rgba(212,175,55,0.2)]"
          >
            <span className="flex h-1.5 w-1.5 rounded-full bg-[#FFD700] animate-pulse"></span>
            <span>Web App</span>
          </Link>
        </nav>

        {/* Right Actions */}
        <div className="hidden lg:flex items-center gap-4">
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 font-mono">
            <UserCheck className="h-3.5 w-3.5 text-[#10B981]" />
            <span className="font-semibold text-white">Tier-1 Auth</span>
          </div>

          <Link
            href="/app"
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#AA820A] px-4.5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider text-black shadow-[0_0_25px_rgba(212,175,55,0.35)] hover:brightness-110 transition-all"
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Launch Web Studio</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
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
        <div className="md:hidden border-b border-[rgba(212,175,55,0.2)] bg-[#070709] px-6 py-6 space-y-4 font-mono text-sm">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-slate-300 hover:text-white uppercase"
          >
            Explore
          </Link>
          <Link
            href="/venues"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-slate-300 hover:text-white uppercase"
          >
            Global Palaces &amp; Arenas
          </Link>
          <Link
            href="/vendors"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-slate-300 hover:text-white uppercase"
          >
            Production Crews
          </Link>
          <Link
            href="/technology"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-slate-300 hover:text-white uppercase"
          >
            Deep-Tech Architecture
          </Link>
          <Link
            href="/escrow"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-slate-300 hover:text-white uppercase"
          >
            Milestone Escrow Vault
          </Link>
          <Link
            href="/contact"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-slate-300 hover:text-white uppercase"
          >
            Enterprise Dispatch
          </Link>
          <Link
            href="/app"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-between text-[#FFD700] font-bold uppercase"
          >
            <span>Launch Web App</span>
            <span className="rounded bg-[#FFD700]/20 px-2 py-0.5 text-xs text-[#FFD700]">LIVE</span>
          </Link>
          <div className="pt-4 border-t border-white/10 space-y-3">
            <Link
              href="/app"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full text-center rounded-lg bg-[#D4AF37] py-2.5 text-xs font-bold uppercase text-black shadow-lg"
            >
              Launch Eventalogy Studio
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
