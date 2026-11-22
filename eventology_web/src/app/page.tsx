"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  MessageCircle,
  Instagram,
  Laptop,
  ShieldCheck,
  Star,
  CheckCircle2,
  Building,
  Palette,
  Speaker,
  UtensilsCrossed,
  Layers,
  PhoneCall,
  Crown,
  Camera,
  HeartHandshake,
  MapPin,
  Users,
  Check,
  Calendar,
  Lock,
  Phone,
  Mail,
} from "lucide-react";

import CallbackModal from "@/components/CallbackModal";

export default function HomePage() {
  const [callbackModalOpen, setCallbackModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[#18181B] font-outfit antialiased selection:bg-[#FDE68A] selection:text-[#78350F]">
      {/* ── CALLBACK CONCIERGE MODAL ────────────────────────────────────────── */}
      <CallbackModal
        isOpen={callbackModalOpen}
        onClose={() => setCallbackModalOpen(false)}
      />

      {/* ── 1. HERO SECTION & INTEGRATED BRAND IDENTITY (NO SEPARATE HEADER) ─── */}
      <section className="relative px-6 lg:px-8 pt-10 pb-16 md:pt-16 md:pb-24 max-w-7xl mx-auto space-y-10">
        {/* Integrated Brand Identity at Top of Page */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-8 border-b border-[#E8E2D5]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] shadow-sm text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-outfit text-xl sm:text-2xl font-black tracking-wider text-[#18181B]">
                  EVENTALOGY
                </span>
                <span className="font-outfit text-xs font-extrabold tracking-widest text-[#B8860B] uppercase">
                  INTERNATIONAL
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Royal Weddings &bull; Stadium Concerts &bull; Luxury Galas
              </p>
            </div>
          </div>

          {/* Quick Access Badges */}
          <div className="flex items-center gap-2.5">
            <a
              href="https://wa.me/917714009000?text=Hi%20Eventalogy!%20I%20would%20like%20to%20plan%20an%20event."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
              <span>WhatsApp 24/7</span>
            </a>

            <button
              onClick={() => setCallbackModalOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#FFF8E7] px-3.5 py-1.5 text-xs font-bold text-[#B8860B] hover:bg-[#FDF3DE] transition-colors"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>Request Callback</span>
            </button>
          </div>
        </div>

        {/* Hero Title & Subtitle */}
        <div className="text-center pt-4 max-w-4xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#FFF8E7] px-4 py-1.5 shadow-sm">
            <Sparkles className="h-4 w-4 text-[#B8860B]" />
            <span className="font-outfit text-xs sm:text-sm font-bold tracking-wider text-[#B8860B] uppercase">
              Premier Global Event Production &bull; Handpicked Venues
            </span>
          </div>

          <h1 className="font-outfit text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-[#18181B] leading-[1.08]">
            Curating <span className="gold-gradient-text">Extraordinary</span> Celebrations Worldwide.
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-2xl mx-auto">
            From heritage palaces in Rajasthan and coastal lawns in Goa, to mega concerts and corporate summits —{" "}
            <span className="text-[#B8860B] font-bold">Eventalogy International</span> is your complete production partner.
            Enter our web app, chat with our automated bots, or connect directly with our directors.
          </p>
        </div>

        {/* ── THE 3 GATEWAY HUBS (WEB APP • WHATSAPP • INSTAGRAM) ─────────── */}
        <div id="gateways" className="pt-2 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Gateway 1: Web App Studio */}
          <div className="rounded-3xl border border-[#D4AF37]/35 bg-white p-7 shadow-[0_8px_30px_rgba(184,134,11,0.08)] hover:shadow-[0_12px_40px_rgba(184,134,11,0.18)] hover:border-[#B8860B] transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF8E7] border border-[#FDE68A] text-[#B8860B] shadow-sm group-hover:scale-105 transition-transform">
                  <Laptop className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  INSTANT IN-BROWSER
                </span>
              </div>
              <h2 className="font-outfit text-2xl font-bold text-[#18181B] group-hover:text-[#B8860B] transition-colors">
                Web App Studio
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Open our interactive workspace. Explore 450+ verified venues, design seating layouts, receive live
                itemized vendor bids, and manage milestone payments.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100">
              <Link
                href="/app"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#B8860B] via-[#D4AF37] to-[#C59B27] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:brightness-105 active:scale-95 transition-all"
              >
                <span>Launch Web App</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {/* Gateway 2: WhatsApp Bot & Concierge */}
          <div className="rounded-3xl border border-emerald-200 bg-white p-7 shadow-[0_8px_30px_rgba(5,150,105,0.08)] hover:shadow-[0_12px_40px_rgba(5,150,105,0.18)] hover:border-emerald-400 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-sm group-hover:scale-105 transition-transform">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  24/7 AUTOMATED BOT
                </span>
              </div>
              <h2 className="font-outfit text-2xl font-bold text-[#18181B] group-hover:text-emerald-700 transition-colors">
                WhatsApp Concierge
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Chat directly with our automated assistant. Get instant budget estimates, check venue date
                availabilities, and connect directly with senior event directors.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100">
              <a
                href="https://wa.me/917714009000?text=Hi%20Eventalogy!%20I%20would%20like%20to%20plan%20an%20event."
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md active:scale-95 transition-all"
              >
                <span>Chat on WhatsApp</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Gateway 3: Instagram Reels & Inspiration */}
          <div className="rounded-3xl border border-pink-200 bg-white p-7 shadow-[0_8px_30px_rgba(219,39,119,0.08)] hover:shadow-[0_12px_40px_rgba(219,39,119,0.18)] hover:border-pink-400 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 border border-pink-200 text-pink-600 shadow-sm group-hover:scale-105 transition-transform">
                  <Instagram className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-pink-50 px-3 py-1 text-[11px] font-bold text-pink-700 border border-pink-200">
                  REAL EVENT REELS
                </span>
              </div>
              <h2 className="font-outfit text-2xl font-bold text-[#18181B] group-hover:text-pink-700 transition-colors">
                Instagram &amp; Reels
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                Explore real event footage, behind-the-scenes stage lighting, celebrity concerts, and floral
                mandap decor. Drop a DM to trigger our Instagram event concierge.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 hover:brightness-105 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md active:scale-95 transition-all"
              >
                <span>Explore on Instagram</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. TRUST STRIP ─────────────────────────────────────────────────── */}
      <section className="border-y border-[#E8E2D5] bg-white py-8 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <p className="font-outfit text-3xl sm:text-4xl font-extrabold text-[#B8860B]">1,200+</p>
            <p className="text-xs text-slate-600 font-medium">Curated Luxury Events</p>
          </div>
          <div className="space-y-1">
            <p className="font-outfit text-3xl sm:text-4xl font-extrabold text-[#18181B]">450+</p>
            <p className="text-xs text-slate-600 font-medium">Handpicked Palaces &amp; Arenas</p>
          </div>
          <div className="space-y-1">
            <p className="font-outfit text-3xl sm:text-4xl font-extrabold text-emerald-600">100%</p>
            <p className="text-xs text-slate-600 font-medium">Milestone Escrow Security</p>
          </div>
          <div className="space-y-1">
            <p className="font-outfit text-3xl sm:text-4xl font-extrabold text-[#18181B]">4.95 / 5</p>
            <p className="text-xs text-slate-600 font-medium">Verified Client Satisfaction</p>
          </div>
        </div>
      </section>

      {/* ── 3. EVERYTHING YOU NEED UNDER ONE ROOF (6 CATEGORIES) ─────────────── */}
      <section id="services" className="py-20 lg:py-28 px-6 lg:px-8 max-w-7xl mx-auto space-y-14">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF8E7] px-3.5 py-1 text-xs font-bold text-[#B8860B] border border-[#FDE68A] uppercase tracking-widest">
            <Crown className="h-3.5 w-3.5" />
            <span>Complete Event Services</span>
          </div>
          <h2 className="font-outfit text-3xl sm:text-5xl font-black text-[#18181B]">
            Everything You Need Under One Roof
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Forget coordinating between 20 separate contractors. Eventalogy International unifies verified luxury venues,
            floral designers, stage sound engineers, and royal banquets under one trusted directorate.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Category 1: Venues */}
          <div className="rounded-3xl border border-[#E8E2D5] bg-white p-6 hover:border-[#D4AF37] hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm group">
            <div className="space-y-4">
              <div className="h-44 w-full rounded-2xl overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=800&auto=format&fit=crop"
                  alt="Luxury Venues"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 right-3 rounded-full bg-white/90 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-[#B8860B] shadow-sm">
                  450+ Venues
                </span>
                <span className="absolute bottom-3 left-3 font-outfit text-lg font-bold text-white drop-shadow-md">
                  Palaces &amp; Heritage Forts
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Grand royal palaces in Jaipur, beachfront lawns in Goa, and 3,000-pax pillarless arenas in Delhi NCR with verified dates and clear sound permits.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#B8860B]">
              <span>Verified Heritage Inventory</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
          </div>

          {/* Category 2: Decor & Floral Architecture */}
          <div className="rounded-3xl border border-[#E8E2D5] bg-white p-6 hover:border-[#D4AF37] hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm group">
            <div className="space-y-4">
              <div className="h-44 w-full rounded-2xl overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=800&auto=format&fit=crop"
                  alt="Thematic Decor"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 right-3 rounded-full bg-white/90 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-[#B8860B] shadow-sm">
                  Custom Concepts
                </span>
                <span className="absolute bottom-3 left-3 font-outfit text-lg font-bold text-white drop-shadow-md">
                  Thematic Decor &amp; Mandaps
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Carved wooden pavilions, illuminated entry tunnels, crystal chandeliers, floral arches, and ambient fairy-lit garden walkways.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#B8860B]">
              <span>Bespoke Set Design</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
          </div>

          {/* Category 3: Audio & Concert Lighting */}
          <div className="rounded-3xl border border-[#E8E2D5] bg-white p-6 hover:border-[#D4AF37] hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm group">
            <div className="space-y-4">
              <div className="h-44 w-full rounded-2xl overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop"
                  alt="Sound & Lighting"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 right-3 rounded-full bg-white/90 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-[#B8860B] shadow-sm">
                  Concert Grade
                </span>
                <span className="absolute bottom-3 left-3 font-outfit text-lg font-bold text-white drop-shadow-md">
                  Audio, Lights &amp; 4K LED
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                JBL VTX &amp; L-Acoustics line arrays, grandMA3 intelligent beam fixtures, high-refresh 4K LED backdrops, and silent DG power generators.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#B8860B]">
              <span>Certified Sound Engineers</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
          </div>

          {/* Category 4: Catering & Royal Banquets */}
          <div className="rounded-3xl border border-[#E8E2D5] bg-white p-6 hover:border-[#D4AF37] hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm group">
            <div className="space-y-4">
              <div className="h-44 w-full rounded-2xl overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1555244162-803834f70033?q=80&w=800&auto=format&fit=crop"
                  alt="Royal Catering"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 right-3 rounded-full bg-white/90 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-[#B8860B] shadow-sm">
                  FSSAI Certified
                </span>
                <span className="absolute bottom-3 left-3 font-outfit text-lg font-bold text-white drop-shadow-md">
                  Royal Banquets &amp; Dining
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Multi-cuisine royal buffets, live artisan street food stations, premium cocktail mixology bars, and uniformed five-star banquet crews.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#B8860B]">
              <span>White-Glove Hospitality</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
          </div>

          {/* Category 5: Cinematic Films & Photography */}
          <div className="rounded-3xl border border-[#E8E2D5] bg-white p-6 hover:border-[#D4AF37] hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm group">
            <div className="space-y-4">
              <div className="h-44 w-full rounded-2xl overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=800&auto=format&fit=crop"
                  alt="Photography"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 right-3 rounded-full bg-white/90 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-[#B8860B] shadow-sm">
                  4K Cinema
                </span>
                <span className="absolute bottom-3 left-3 font-outfit text-lg font-bold text-white drop-shadow-md">
                  Films &amp; Photography
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Pre-wedding destination shoots, cinematic 4K drone videography, candid emotional portraiture, and instant same-day teaser edits.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#B8860B]">
              <span>Celebrity Shooters</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
          </div>

          {/* Category 6: Entertainment & Celebrity Artists */}
          <div className="rounded-3xl border border-[#E8E2D5] bg-white p-6 hover:border-[#D4AF37] hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm group">
            <div className="space-y-4">
              <div className="h-44 w-full rounded-2xl overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=800&auto=format&fit=crop"
                  alt="Live Artists"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 right-3 rounded-full bg-white/90 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-[#B8860B] shadow-sm">
                  A-List Talent
                </span>
                <span className="absolute bottom-3 left-3 font-outfit text-lg font-bold text-white drop-shadow-md">
                  Celebrity Artists &amp; DJs
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Bollywood playback singers, Sufi ensembles, club-circuit DJs, traditional Punjabi dhol troupes, and international aerial performers.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#B8860B]">
              <span>Direct Roster Booking</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. FEATURED LUXURY VENUES (TRANSPARENT TARIFFS & PAX) ─────────── */}
      <section className="py-16 px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF8E7] px-3 py-1 text-xs font-bold text-[#B8860B] border border-[#FDE68A] uppercase tracking-widest">
              <Building className="h-3.5 w-3.5" />
              <span>Handpicked Destinations</span>
            </div>
            <h2 className="font-outfit text-3xl sm:text-4xl font-black text-[#18181B] mt-2">
              Featured Luxury Venues
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              Verified availability, upfront transparent pricing, and confirmed technical load-in specs.
            </p>
          </div>

          <button
            onClick={() => setCallbackModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#B8860B] hover:underline"
          >
            <span>Request Full 450+ Venue Catalog</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Venue 1 */}
          <div className="rounded-3xl border border-[#E8E2D5] bg-white overflow-hidden flex flex-col justify-between hover:border-[#D4AF37] hover:shadow-xl transition-all shadow-sm group">
            <div>
              <div className="h-48 w-full relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop"
                  alt="Jaipur Palace"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-white flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#FDE68A]" />
                  <span>Jaipur, Rajasthan</span>
                </span>
                <span className="absolute bottom-3 right-3 rounded-full bg-[#B8860B] text-white px-2.5 py-1 text-[11px] font-bold shadow-sm">
                  ₹5,20,000 / day
                </span>
              </div>
              <div className="p-5 space-y-2">
                <h3 className="font-outfit text-lg font-bold text-[#18181B] group-hover:text-[#B8860B] transition-colors">
                  The Grand Imperial Fort
                </h3>
                <p className="text-xs text-slate-600">
                  Authentic heritage palace with royal courtyards, fountain lawn, and grand chandeliers.
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 font-medium">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-[#B8860B]" />
                    <span>1,200 Pax</span>
                  </span>
                  <span>Heritage Lawn</span>
                </div>
              </div>
            </div>
            <div className="p-5 pt-0">
              <Link
                href="/app"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#D4AF37] bg-[#FFF8E7] py-2.5 text-xs font-bold text-[#B8860B] hover:bg-[#B8860B] hover:text-white transition-all"
              >
                <span>Book via Web App</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Venue 2 */}
          <div className="rounded-3xl border border-[#E8E2D5] bg-white overflow-hidden flex flex-col justify-between hover:border-[#D4AF37] hover:shadow-xl transition-all shadow-sm group">
            <div>
              <div className="h-48 w-full relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop"
                  alt="Goa Beachfront"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-white flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#FDE68A]" />
                  <span>North Goa</span>
                </span>
                <span className="absolute bottom-3 right-3 rounded-full bg-[#B8860B] text-white px-2.5 py-1 text-[11px] font-bold shadow-sm">
                  ₹4,80,000 / day
                </span>
              </div>
              <div className="p-5 space-y-2">
                <h3 className="font-outfit text-lg font-bold text-[#18181B] group-hover:text-[#B8860B] transition-colors">
                  Seaside Horizon Lawn
                </h3>
                <p className="text-xs text-slate-600">
                  Open-air oceanfront lawns with private beach access, sunset deck, and breezy cabanas.
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 font-medium">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-[#B8860B]" />
                    <span>450 Pax</span>
                  </span>
                  <span>Beachfront</span>
                </div>
              </div>
            </div>
            <div className="p-5 pt-0">
              <Link
                href="/app"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#D4AF37] bg-[#FFF8E7] py-2.5 text-xs font-bold text-[#B8860B] hover:bg-[#B8860B] hover:text-white transition-all"
              >
                <span>Book via Web App</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Venue 3 */}
          <div className="rounded-3xl border border-[#E8E2D5] bg-white overflow-hidden flex flex-col justify-between hover:border-[#D4AF37] hover:shadow-xl transition-all shadow-sm group">
            <div>
              <div className="h-48 w-full relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop"
                  alt="Delhi Convention Arena"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-white flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#FDE68A]" />
                  <span>Aerocity, Delhi</span>
                </span>
                <span className="absolute bottom-3 right-3 rounded-full bg-[#B8860B] text-white px-2.5 py-1 text-[11px] font-bold shadow-sm">
                  ₹12,00,000 / day
                </span>
              </div>
              <div className="p-5 space-y-2">
                <h3 className="font-outfit text-lg font-bold text-[#18181B] group-hover:text-[#B8860B] transition-colors">
                  Imperial Convention Arena
                </h3>
                <p className="text-xs text-slate-600">
                  Massive pillarless arena with 20m ceiling height, heavy truss rigging, and 500 kVA dual DG.
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 font-medium">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-[#B8860B]" />
                    <span>3,000 Pax</span>
                  </span>
                  <span>Mega Arena</span>
                </div>
              </div>
            </div>
            <div className="p-5 pt-0">
              <Link
                href="/app"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#D4AF37] bg-[#FFF8E7] py-2.5 text-xs font-bold text-[#B8860B] hover:bg-[#B8860B] hover:text-white transition-all"
              >
                <span>Book via Web App</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Venue 4 */}
          <div className="rounded-3xl border border-[#E8E2D5] bg-white overflow-hidden flex flex-col justify-between hover:border-[#D4AF37] hover:shadow-xl transition-all shadow-sm group">
            <div>
              <div className="h-48 w-full relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800&auto=format&fit=crop"
                  alt="Raipur Imperial Lawn"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-white flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#FDE68A]" />
                  <span>Raipur, CG</span>
                </span>
                <span className="absolute bottom-3 right-3 rounded-full bg-[#B8860B] text-white px-2.5 py-1 text-[11px] font-bold shadow-sm">
                  ₹3,50,000 / day
                </span>
              </div>
              <div className="p-5 space-y-2">
                <h3 className="font-outfit text-lg font-bold text-[#18181B] group-hover:text-[#B8860B] transition-colors">
                  The Grand Imperial Lawn
                </h3>
                <p className="text-xs text-slate-600">
                  Manicured emerald green lawn with 125 kVA 3-phase power and air-conditioned banquet wing.
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-500 pt-2 font-medium">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-[#B8860B]" />
                    <span>650 Pax</span>
                  </span>
                  <span>Lawn &amp; Hall</span>
                </div>
              </div>
            </div>
            <div className="p-5 pt-0">
              <Link
                href="/app"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#D4AF37] bg-[#FFF8E7] py-2.5 text-xs font-bold text-[#B8860B] hover:bg-[#B8860B] hover:text-white transition-all"
              >
                <span>Book via Web App</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. HOW IT WORKS (3 SIMPLE, FRIENDLY STEPS) ──────────────────────── */}
      <section className="py-20 lg:py-28 px-6 lg:px-8 max-w-7xl mx-auto space-y-14 bg-[#FAF7F2] rounded-3xl border border-[#E8E2D5] my-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF8E7] px-3.5 py-1 text-xs font-bold text-[#B8860B] border border-[#FDE68A] uppercase tracking-widest">
            <HeartHandshake className="h-3.5 w-3.5" />
            <span>Stress-Free Planning</span>
          </div>
          <h2 className="font-outfit text-3xl sm:text-5xl font-black text-[#18181B]">
            How It Works in 3 Easy Steps
          </h2>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Planning a celebration shouldn&apos;t feel overwhelming. We make finding venues, booking specialists, and executing your day effortless.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="rounded-3xl border border-[#E8E2D5] bg-white p-8 space-y-4 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF8E7] text-[#B8860B] border border-[#FDE68A] font-outfit text-xl font-black">
              1
            </div>
            <h3 className="font-outfit text-2xl font-bold text-[#18181B]">
              Share Your Vision &amp; Dates
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tell us your target destination, guest count, and event style. Launch our web app for interactive layout planning or message our WhatsApp bot.
            </p>
            <div className="pt-2 text-xs text-[#B8860B] font-semibold flex items-center justify-center gap-1">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>Instant budget estimations</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-3xl border border-[#E8E2D5] bg-white p-8 space-y-4 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF8E7] text-[#B8860B] border border-[#FDE68A] font-outfit text-xl font-black">
              2
            </div>
            <h3 className="font-outfit text-2xl font-bold text-[#18181B]">
              Pick Venues &amp; Specialists
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Explore verified 5-star venue photos, real pricing, and certified catering/sound specialists. Lock dates with zero guesswork and complete transparency.
            </p>
            <div className="pt-2 text-xs text-[#B8860B] font-semibold flex items-center justify-center gap-1">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>100% verified KYC contractors</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-3xl border border-[#E8E2D5] bg-white p-8 space-y-4 text-center shadow-sm">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF8E7] text-[#B8860B] border border-[#FDE68A] font-outfit text-xl font-black">
              3
            </div>
            <h3 className="font-outfit text-2xl font-bold text-[#18181B]">
              Celebrate with Peace of Mind
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Our on-ground production director oversees soundcheck, vendor coordination, and timelines. Payments stay safe in our 25/50/25 milestone escrow.
            </p>
            <div className="pt-2 text-xs text-[#B8860B] font-semibold flex items-center justify-center gap-1">
              <Check className="h-4 w-4 text-emerald-600" />
              <span>Dedicated on-site director</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. THE WEB APP DIGITAL STUDIO PREVIEW ───────────────────────────── */}
      <section className="py-16 px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>The Eventalogy Digital Studio</span>
            </div>
            <h2 className="font-outfit text-3xl sm:text-5xl font-black text-[#18181B] leading-tight">
              All Digital Drafting, Reverse Bidding &amp; Contracts Live in the Web App.
            </h2>
            <p className="text-slate-600 text-base leading-relaxed">
              When you launch our web app, you unlock the complete operational command center. No app downloads
              required — everything works smoothly in your desktop or mobile browser.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF8E7] text-[#B8860B] shrink-0 mt-0.5 border border-[#FDE68A]">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-[#18181B] text-sm">Interactive Seating &amp; Stage Layout Studio</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Plan banquet tables, stage risers, lighting trusses, and guest seating with instant capacity math.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF8E7] text-[#B8860B] shrink-0 mt-0.5 border border-[#FDE68A]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-[#18181B] text-sm">Direct Reverse Vendor Bidding</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verified sound, lighting, and catering contractors submit itemized proposals for your dates — saving you up to 25%.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 shrink-0 mt-0.5 border border-emerald-200">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-[#18181B] text-sm">25/50/25 Milestone Escrow Protection</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your money stays locked safely: 25% to book, 50% on soundcheck setup, and 25% only after successful event sign-off.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-4">
              <Link
                href="/app"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#B8860B] via-[#D4AF37] to-[#C59B27] px-6 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-white shadow-md hover:brightness-105 active:scale-95 transition-all"
              >
                <span>Launch Web App Studio</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <span className="text-xs text-slate-500 font-medium">100% Free to Explore &bull; Zero Installation</span>
            </div>
          </div>

          {/* Right Visual Box */}
          <div className="lg:col-span-6">
            <div className="rounded-3xl border border-[#E8E2D5] bg-white p-5 shadow-xl space-y-4">
              {/* Window Controls */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 px-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-400"></span>
                  <span className="h-3 w-3 rounded-full bg-amber-400"></span>
                  <span className="h-3 w-3 rounded-full bg-emerald-400"></span>
                  <span className="ml-2 font-mono text-xs text-slate-500">app.eventology.in/studio</span>
                </div>
                <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-700 border border-emerald-200">
                  STUDIO ACTIVE
                </span>
              </div>

              {/* Graphic Mockup */}
              <div className="rounded-2xl border border-slate-100 bg-[#FAF8F5] p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[#18181B]">Grand Courtyard &amp; Royal Pavilion</p>
                    <p className="text-xs text-slate-500">Venue Capacity: 1,200 Pax &bull; Current Layout: 780 Seats</p>
                  </div>
                  <span className="rounded bg-[#FFF8E7] border border-[#FDE68A] px-2.5 py-1 text-xs font-bold text-[#B8860B]">
                    STAGE OK
                  </span>
                </div>

                <div className="h-48 rounded-xl bg-white border border-slate-200 relative flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#00000008_1px,transparent_1px),linear-gradient(to_bottom,#00000008_1px,transparent_1px)] bg-[size:18px_18px]" />
                  <div className="relative text-center space-y-2">
                    <div className="mx-auto h-12 w-52 rounded-xl border border-[#D4AF37] bg-[#FFF8E7] flex items-center justify-center text-xs font-bold text-[#B8860B] shadow-sm">
                      MAIN PERFORMANCE STAGE (45x22 ft)
                    </div>
                    <div className="flex justify-center gap-2 pt-1">
                      <span className="h-4 w-4 rounded-full bg-amber-100 border border-amber-300"></span>
                      <span className="h-4 w-4 rounded-full bg-amber-100 border border-amber-300"></span>
                      <span className="h-4 w-4 rounded-full bg-amber-100 border border-amber-300"></span>
                      <span className="h-4 w-4 rounded-full bg-amber-100 border border-amber-300"></span>
                      <span className="h-4 w-4 rounded-full bg-amber-100 border border-amber-300"></span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium">
                      48 VIP Tables &bull; Dual Line Arrays &bull; 4K LED Backdrop
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-white border border-slate-100 p-2.5">
                    <p className="text-[10px] text-slate-500">Escrow Locked</p>
                    <p className="font-bold text-[#18181B]">₹42,50,000</p>
                  </div>
                  <div className="rounded-xl bg-white border border-slate-100 p-2.5">
                    <p className="text-[10px] text-slate-500">Live Bids</p>
                    <p className="font-bold text-[#B8860B]">16 Verified</p>
                  </div>
                  <div className="rounded-xl bg-white border border-slate-100 p-2.5">
                    <p className="text-[10px] text-slate-500">Day-Of Timeline</p>
                    <p className="font-bold text-emerald-600">On Track</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. FULL PLANNING CONCIERGE BANNER ───────────────────────────────── */}
      <section className="py-16 px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="rounded-3xl border border-[#D4AF37]/50 bg-gradient-to-r from-[#FFFBF2] via-[#FFFDF8] to-[#FFFBF2] p-10 sm:p-14 lg:p-16 space-y-6 shadow-[0_15px_50px_rgba(184,134,11,0.12)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#FFF8E7] px-4 py-1.5 text-xs font-bold text-[#B8860B] border border-[#FDE68A]">
            <Sparkles className="h-4 w-4" />
            <span>FULL-SERVICE EVENT CONCIERGE</span>
          </div>

          <h2 className="font-outfit text-3xl sm:text-5xl font-black text-[#18181B] max-w-3xl mx-auto leading-tight">
            Want Our Team to Handle Everything from Start to Finish?
          </h2>

          <p className="mx-auto max-w-2xl text-slate-600 text-sm sm:text-base leading-relaxed">
            Sit back and enjoy your celebration. Our senior directors curate venues, negotiate vendor contracts, run soundchecks, and coordinate day-of execution on site.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={() => setCallbackModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#B8860B] via-[#D4AF37] to-[#C59B27] px-7 py-3.5 font-outfit text-xs sm:text-sm font-bold uppercase tracking-wider text-white shadow-md hover:brightness-105 active:scale-95 transition-all"
            >
              <PhoneCall className="h-4 w-4" />
              <span>Request a Call Back</span>
            </button>

            <a
              href="https://wa.me/917714009000?text=Hi%20Eventalogy!%20I%20would%20like%20to%20plan%20an%20event."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-7 py-3.5 font-outfit text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-700 hover:bg-emerald-100 transition-all"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Chat on WhatsApp</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── 8. INTEGRATED SINGLE-PAGE FOOTER ─────────────────────────────────── */}
      <footer className="border-t border-[#E8E2D5] bg-white py-12 px-6 lg:px-8 text-slate-600 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="font-outfit font-black text-sm text-[#18181B] tracking-wider">
                EVENTALOGY INTERNATIONAL
              </p>
              <p className="text-[11px] text-slate-500">
                Royal Weddings &bull; Concerts &bull; Luxury Galas &bull; 100% Milestone Protected
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-medium text-slate-600">
            <Link href="/app" className="hover:text-[#B8860B] transition-colors">
              Web App Studio
            </Link>
            <a
              href="https://wa.me/917714009000?text=Hi%20Eventalogy!"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-emerald-700 transition-colors"
            >
              WhatsApp Concierge
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-pink-600 transition-colors"
            >
              Instagram Reels
            </a>
            <button
              onClick={() => setCallbackModalOpen(true)}
              className="hover:text-[#B8860B] transition-colors"
            >
              Request Callback
            </button>
          </div>

          <p className="text-slate-400">
            &copy; {new Date().getFullYear()} Eventalogy International Ltd. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
