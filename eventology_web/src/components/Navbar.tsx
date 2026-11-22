"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Menu, X, Sparkles, Calendar, MapPin, Users, PhoneCall, ShieldCheck } from "lucide-react";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#D4AF37]/20 bg-[#070709]/90 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3.5 group">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] via-[#AA820A] to-[#604403] border border-[#FFD700]/40 shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-transform group-hover:scale-105">
            <Sparkles className="h-6 w-6 text-black" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-syne text-xl sm:text-2xl font-extrabold tracking-wider text-white">
                EVENTALOGY
              </span>
              <span className="font-syne text-xs font-bold tracking-widest text-[#D4AF37] uppercase">
                INTERNATIONAL
              </span>
            </div>
            <p className="text-[10px] tracking-wider text-slate-400 font-medium">
              Luxury Events • Grand Venues • Production Studio
            </p>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2 text-sm font-medium">
          <Link
            href="/"
            className="rounded-lg px-3.5 py-2 text-slate-200 hover:text-white hover:bg-white/5 transition-colors"
          >
            Home
          </Link>
          <Link
            href="/venues"
            className="rounded-lg px-3.5 py-2 text-slate-200 hover:text-[#FFD700] hover:bg-white/5 transition-colors flex items-center gap-1.5"
          >
            <span>Luxury Venues</span>
          </Link>
          <Link
            href="/vendors"
            className="rounded-lg px-3.5 py-2 text-slate-200 hover:text-[#FFD700] hover:bg-white/5 transition-colors"
          >
            Services &amp; Vendors
          </Link>
          <Link
            href="/escrow"
            className="rounded-lg px-3.5 py-2 text-slate-200 hover:text-[#FFD700] hover:bg-white/5 transition-colors flex items-center gap-1"
          >
            <ShieldCheck className="h-4 w-4 text-[#10B981]" />
            <span>Safe Escrow</span>
          </Link>
          <Link
            href="/contact"
            className="rounded-lg px-3.5 py-2 text-slate-200 hover:text-white hover:bg-white/5 transition-colors"
          >
            Contact
          </Link>
        </nav>

        {/* Right Action Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/contact"
            className="rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white hover:bg-white/5 border border-white/10 transition-all"
          >
            Plan an Event
          </Link>
          <Link
            href="/app"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#AA820A] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.4)] hover:brightness-110 active:scale-95 transition-all"
          >
            <span>Launch Web App</span>
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden rounded-lg p-2 text-slate-300 hover:text-white hover:bg-white/5 focus:outline-none"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#070709] px-6 py-6 space-y-4">
          <div className="flex flex-col space-y-2 text-base font-medium">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-4 py-2.5 text-slate-200 hover:bg-white/5"
            >
              Home
            </Link>
            <Link
              href="/venues"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-4 py-2.5 text-slate-200 hover:bg-white/5"
            >
              Luxury Venues
            </Link>
            <Link
              href="/vendors"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-4 py-2.5 text-slate-200 hover:bg-white/5"
            >
              Services &amp; Vendors
            </Link>
            <Link
              href="/escrow"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-4 py-2.5 text-slate-200 hover:bg-white/5"
            >
              Safe Escrow Protection
            </Link>
            <Link
              href="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-4 py-2.5 text-slate-200 hover:bg-white/5"
            >
              Contact &amp; Bookings
            </Link>
          </div>

          <div className="pt-4 border-t border-white/10 space-y-3">
            <Link
              href="/app"
              onClick={() => setMobileMenuOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#FFD700] py-3 text-sm font-bold uppercase tracking-wider text-black shadow-lg"
            >
              <span>Launch Event Web App</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              onClick={() => setMobileMenuOpen(false)}
              className="flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-white"
            >
              Talk to an Event Specialist
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
