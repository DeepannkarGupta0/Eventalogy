"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Sparkles,
  ArrowUpRight,
  Menu,
  X,
  MessageCircle,
  Instagram,
  Laptop,
  ShieldCheck,
} from "lucide-react";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-[#070709]/80 backdrop-blur-xl shadow-lg">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3.5 group">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] via-[#AA820A] to-[#604403] border border-[#FFD700]/40 shadow-[0_0_20px_rgba(212,175,55,0.35)] transition-transform group-hover:scale-105">
            <Sparkles className="h-6 w-6 text-black" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-outfit text-xl sm:text-2xl font-black tracking-wider text-white">
                EVENTALOGY
              </span>
              <span className="font-outfit text-[10px] sm:text-xs font-bold tracking-widest text-[#FFD700] uppercase">
                INTERNATIONAL
              </span>
            </div>
            <p className="text-[10px] tracking-wider text-slate-400 font-medium">
              Royal Weddings &bull; Concerts &bull; Global Events
            </p>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-2 text-sm font-medium">
          <Link
            href="#what-we-do"
            className="rounded-lg px-3.5 py-2 text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            What We Do
          </Link>
          <Link
            href="#gateways"
            className="rounded-lg px-3.5 py-2 text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            How To Book
          </Link>
          <Link
            href="/venues"
            className="rounded-lg px-3.5 py-2 text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Venues
          </Link>
          <Link
            href="/vendors"
            className="rounded-lg px-3.5 py-2 text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
          >
            Services
          </Link>
          <Link
            href="/escrow"
            className="rounded-lg px-3.5 py-2 text-slate-300 hover:text-emerald-400 hover:bg-white/5 transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Safe Escrow</span>
          </Link>
        </nav>

        {/* Right Action Channels */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* Instagram Button */}
          <a
            href="https://instagram.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-pink-400 hover:border-pink-500/40 hover:bg-pink-500/10 transition-all"
            title="Follow on Instagram"
          >
            <Instagram className="h-4 w-4" />
          </a>

          {/* WhatsApp Direct Bot */}
          <a
            href="https://wa.me/917714009000?text=Hi%20Eventalogy!%20I%20would%20like%20to%20plan%20an%20event."
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all"
          >
            <MessageCircle className="h-4 w-4" />
            <span>WhatsApp Bot</span>
          </a>

          {/* Web App Launch Button */}
          <Link
            href="/app"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#AA820A] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-black shadow-[0_0_20px_rgba(212,175,55,0.35)] hover:brightness-110 active:scale-95 transition-all"
          >
            <Laptop className="h-4 w-4" />
            <span>Launch Web App</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
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
              href="#what-we-do"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-lg px-4 py-2.5 text-slate-200 hover:bg-white/5"
            >
              What We Do
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
              100% Safe Escrow
            </Link>
          </div>

          <div className="pt-4 border-t border-white/10 space-y-3">
            <Link
              href="/app"
              onClick={() => setMobileMenuOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#FFD700] py-3 text-sm font-bold uppercase tracking-wider text-black shadow-lg"
            >
              <Laptop className="h-4 w-4" />
              <span>Enter Web App Studio</span>
            </Link>
            <a
              href="https://wa.me/917714009000?text=Hi%20Eventalogy!%20I%20would%20like%20to%20plan%20an%20event."
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 py-3 text-sm font-bold text-emerald-400"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Chat with WhatsApp Bot</span>
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-slate-200"
            >
              <Instagram className="h-4 w-4 text-pink-400" />
              <span>Follow on Instagram</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
