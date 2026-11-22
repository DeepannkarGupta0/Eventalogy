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
} from "lucide-react";

import ThreeBackground from "@/components/ThreeBackground";
import TiltCard from "@/components/TiltCard";
import Interactive3DStage from "@/components/Interactive3DStage";
import CallbackModal from "@/components/CallbackModal";

export default function HomePage() {
  const [callbackModalOpen, setCallbackModalOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-[#070709] text-white overflow-hidden">
      {/* ── 0. THREE.JS 3D AMBIENT BACKGROUND CANVAS ───────────────────────── */}
      <ThreeBackground />

      {/* ── CALLBACK MODAL ─────────────────────────────────────────────────── */}
      <CallbackModal
        isOpen={callbackModalOpen}
        onClose={() => setCallbackModalOpen(false)}
      />

      {/* ── 1. HERO SECTION & 3 GATEWAY HUBS ─────────────────────────────────── */}
      <section className="relative z-10 px-6 lg:px-8 pt-12 pb-20 md:pt-16 md:pb-28 max-w-7xl mx-auto space-y-12">
        {/* Top Floating Badge */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FFD700]/30 bg-[#FFD700]/10 px-4 py-1.5 shadow-[0_0_20px_rgba(255,215,0,0.15)]">
            <Sparkles className="h-4 w-4 text-[#FFD700]" />
            <span className="font-outfit text-xs sm:text-sm font-bold tracking-wider text-[#FFD700] uppercase">
              Eventalogy International &bull; Royal Weddings &bull; Concerts &bull; Global Summits
            </span>
          </div>

          {/* Warm Luxury Headline */}
          <h1 className="mt-6 font-outfit text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.08]">
            Curating <span className="gold-gradient-text">Extraordinary</span> Celebrations Worldwide.
          </h1>

          {/* Friendly, Clear Subtitle */}
          <p className="mt-6 mx-auto max-w-3xl text-base sm:text-xl text-slate-300 leading-relaxed font-normal">
            Whether you are planning a royal destination wedding, a stadium concert, or a luxury corporate gala,{" "}
            <span className="text-[#FFD700] font-semibold">Eventalogy International</span> is your complete event production
            partner. Enter our digital web app, chat with our automated bots on WhatsApp &amp; Instagram, or connect with our on-ground directors.
          </p>
        </div>

        {/* ── THE 3 GATEWAY CARDS (WEB APP • WHATSAPP • INSTAGRAM) ─────────── */}
        <div id="gateways" className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Gateway 1: Web App Studio */}
          <TiltCard
            glareColor="rgba(255, 215, 0, 0.35)"
            className="border border-[#FFD700]/40 bg-gradient-to-b from-[#1C1A14] to-[#101012] p-8 shadow-2xl flex flex-col justify-between hover:border-[#FFD700] group"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFD700]/20 border border-[#FFD700]/40 text-[#FFD700] shadow-md group-hover:scale-110 transition-transform">
                  <Laptop className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-[#10B981]/15 px-3 py-1 text-[11px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
                  INSTANT IN-BROWSER
                </span>
              </div>
              <h2 className="font-outfit text-2xl font-bold text-white group-hover:text-[#FFD700] transition-colors">
                Web App Studio
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Open our interactive workspace. Design 3D floorplans, browse 450+ verified venues, receive live
                itemized vendor bids, and manage milestone payments.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-white/10">
              <Link
                href="/app"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#FFF0A8] py-3.5 text-xs font-bold uppercase tracking-wider text-black shadow-lg hover:brightness-110 active:scale-95 transition-all"
              >
                <span>Launch Web App</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </TiltCard>

          {/* Gateway 2: WhatsApp Bot & Concierge */}
          <TiltCard
            glareColor="rgba(37, 211, 102, 0.35)"
            className="border border-emerald-500/30 bg-gradient-to-b from-[#0F1E19] to-[#08120F] p-8 shadow-2xl flex flex-col justify-between hover:border-emerald-400 group"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-md group-hover:scale-110 transition-transform">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                  24/7 AUTOMATED BOT
                </span>
              </div>
              <h2 className="font-outfit text-2xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                WhatsApp Concierge
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Chat directly with our automated assistant. Get instant budget estimates, check venue date
                availabilities, and connect directly with our senior event directors.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-white/10">
              <a
                href="https://wa.me/917714009000?text=Hi%20Eventalogy!%20I%20would%20like%20to%20plan%20an%20event."
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 py-3.5 text-xs font-bold uppercase tracking-wider text-black shadow-lg active:scale-95 transition-all"
              >
                <span>Chat on WhatsApp</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </TiltCard>

          {/* Gateway 3: Instagram Reels & Inspiration */}
          <TiltCard
            glareColor="rgba(236, 72, 153, 0.35)"
            className="border border-pink-500/30 bg-gradient-to-b from-[#1C0F19] to-[#0E070D] p-8 shadow-2xl flex flex-col justify-between hover:border-pink-400 group"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/20 border border-pink-500/40 text-pink-400 shadow-md group-hover:scale-110 transition-transform">
                  <Instagram className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-pink-500/20 px-3 py-1 text-[11px] font-mono font-bold text-pink-300 border border-pink-500/30">
                  LIVE REELS &amp; DM BOT
                </span>
              </div>
              <h2 className="font-outfit text-2xl font-bold text-white group-hover:text-pink-300 transition-colors">
                Instagram &amp; Reels
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Explore real event footage, behind-the-scenes stage lighting, celebrity concerts, and floral
                mandap decor. Drop a DM to trigger our Instagram event concierge.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-white/10">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 via-rose-500 to-purple-600 hover:brightness-110 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg active:scale-95 transition-all"
              >
                <span>Explore on Instagram</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </TiltCard>
        </div>
      </section>

      {/* ── 2. TRUST STRIP ─────────────────────────────────────────────────── */}
      <section className="relative z-10 border-y border-white/10 bg-[#141416]/90 backdrop-blur-md py-8 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <p className="font-outfit text-3xl sm:text-4xl font-extrabold text-[#FFD700]">1,200+</p>
            <p className="text-xs text-slate-300 font-medium">Curated Luxury Events</p>
          </div>
          <div className="space-y-1">
            <p className="font-outfit text-3xl sm:text-4xl font-extrabold text-white">450+</p>
            <p className="text-xs text-slate-300 font-medium">Handpicked Palaces &amp; Arenas</p>
          </div>
          <div className="space-y-1">
            <p className="font-outfit text-3xl sm:text-4xl font-extrabold text-emerald-400">100%</p>
            <p className="text-xs text-slate-300 font-medium">Milestone Escrow Security</p>
          </div>
          <div className="space-y-1">
            <p className="font-outfit text-3xl sm:text-4xl font-extrabold text-white">4.95 / 5</p>
            <p className="text-xs text-slate-300 font-medium">Verified Client Satisfaction</p>
          </div>
        </div>
      </section>

      {/* ── 3. POPULAR CATEGORIES (INSPIRED BY SETMYEVENT BUT LUXURY) ───────── */}
      <section id="what-we-do" className="relative z-10 py-20 lg:py-28 px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD700]/10 px-3.5 py-1 text-xs font-bold text-[#FFD700] border border-[#FFD700]/20 uppercase tracking-widest">
            <Crown className="h-3.5 w-3.5" />
            <span>Complete Event Services</span>
          </div>
          <h2 className="font-outfit text-3xl sm:text-5xl font-black text-white">
            Everything You Need Under One Roof
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Forget coordinating between 20 separate contractors. Eventalogy International brings verified luxury venues,
            floral designers, stage sound engineers, and royal banquets together.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Category 1: Venues */}
          <Link
            href="/venues"
            className="group relative rounded-3xl border border-white/10 bg-[#141416] p-6 hover:border-[#FFD700]/60 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-[0_10px_30px_rgba(255,215,0,0.1)]"
          >
            <div className="space-y-4">
              <div className="h-44 w-full rounded-2xl overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=800&auto=format&fit=crop"
                  alt="Luxury Venues"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <span className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-[#FFD700] border border-[#FFD700]/30">
                  450+ Venues
                </span>
                <span className="absolute bottom-3 left-3 font-outfit text-xl font-bold text-white">
                  Palaces &amp; Heritage Forts
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Grand royal palaces in Jaipur, beachfront lawns in Goa, and 3,000-pax pillarless arenas in Delhi NCR with verified dates and clear sound permits.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-white/10 flex items-center justify-between text-xs font-bold text-[#FFD700] group-hover:underline">
              <span>Explore Venue Catalog</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Category 2: Decor & Floral Architecture */}
          <Link
            href="/vendors"
            className="group relative rounded-3xl border border-white/10 bg-[#141416] p-6 hover:border-[#FFD700]/60 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-[0_10px_30px_rgba(255,215,0,0.1)]"
          >
            <div className="space-y-4">
              <div className="h-44 w-full rounded-2xl overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=800&auto=format&fit=crop"
                  alt="Thematic Decor"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <span className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-[#FFD700] border border-[#FFD700]/30">
                  Custom Concepts
                </span>
                <span className="absolute bottom-3 left-3 font-outfit text-xl font-bold text-white">
                  Thematic Decor &amp; Mandaps
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Carved wooden pavilions, illuminated entry tunnels, crystal chandeliers, floral arches, and ambient fairy-lit garden walkways.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-white/10 flex items-center justify-between text-xs font-bold text-[#FFD700] group-hover:underline">
              <span>View Decor Portfolios</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Category 3: Audio & Concert Lighting */}
          <Link
            href="/vendors"
            className="group relative rounded-3xl border border-white/10 bg-[#141416] p-6 hover:border-[#FFD700]/60 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-[0_10px_30px_rgba(255,215,0,0.1)]"
          >
            <div className="space-y-4">
              <div className="h-44 w-full rounded-2xl overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop"
                  alt="Sound & Lighting"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <span className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-[#FFD700] border border-[#FFD700]/30">
                  Concert Grade
                </span>
                <span className="absolute bottom-3 left-3 font-outfit text-xl font-bold text-white">
                  Audio, Lights &amp; 4K LED
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                JBL VTX &amp; L-Acoustics line arrays, grandMA3 intelligent beam fixtures, high-refresh 4K LED backdrops, and silent DG power generators.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-white/10 flex items-center justify-between text-xs font-bold text-[#FFD700] group-hover:underline">
              <span>Explore Technical Gear</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Category 4: Catering & Royal Banquets */}
          <Link
            href="/vendors"
            className="group relative rounded-3xl border border-white/10 bg-[#141416] p-6 hover:border-[#FFD700]/60 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-[0_10px_30px_rgba(255,215,0,0.1)]"
          >
            <div className="space-y-4">
              <div className="h-44 w-full rounded-2xl overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1555244162-803834f70033?q=80&w=800&auto=format&fit=crop"
                  alt="Royal Catering"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <span className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-[#FFD700] border border-[#FFD700]/30">
                  FSSAI Certified
                </span>
                <span className="absolute bottom-3 left-3 font-outfit text-xl font-bold text-white">
                  Royal Banquets &amp; Dining
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Multi-cuisine royal buffets, live artisan street food stations, premium cocktail mixology bars, and uniformed five-star banquet crews.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-white/10 flex items-center justify-between text-xs font-bold text-[#FFD700] group-hover:underline">
              <span>Explore Menus &amp; Bars</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Category 5: Cinematic Films & Photography */}
          <Link
            href="/vendors"
            className="group relative rounded-3xl border border-white/10 bg-[#141416] p-6 hover:border-[#FFD700]/60 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-[0_10px_30px_rgba(255,215,0,0.1)]"
          >
            <div className="space-y-4">
              <div className="h-44 w-full rounded-2xl overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1511285560929-80b456fea0bc?q=80&w=800&auto=format&fit=crop"
                  alt="Photography"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <span className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-[#FFD700] border border-[#FFD700]/30">
                  4K Cinema
                </span>
                <span className="absolute bottom-3 left-3 font-outfit text-xl font-bold text-white">
                  Films &amp; Photography
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Pre-wedding destination shoots, cinematic 4K drone videography, candid emotional portraiture, and instant same-day teaser edits.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-white/10 flex items-center justify-between text-xs font-bold text-[#FFD700] group-hover:underline">
              <span>View Film Galleries</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>

          {/* Category 6: Entertainment & Celebrity Artists */}
          <Link
            href="/vendors"
            className="group relative rounded-3xl border border-white/10 bg-[#141416] p-6 hover:border-[#FFD700]/60 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg hover:shadow-[0_10px_30px_rgba(255,215,0,0.1)]"
          >
            <div className="space-y-4">
              <div className="h-44 w-full rounded-2xl overflow-hidden relative">
                <img
                  src="https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=800&auto=format&fit=crop"
                  alt="Live Artists"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <span className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-[#FFD700] border border-[#FFD700]/30">
                  A-List Talent
                </span>
                <span className="absolute bottom-3 left-3 font-outfit text-xl font-bold text-white">
                  Celebrity Artists &amp; DJs
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Bollywood playback singers, Sufi ensembles, club-circuit DJs, traditional Punjabi dhol troupes, and international aerial performers.
              </p>
            </div>
            <div className="pt-4 mt-2 border-t border-white/10 flex items-center justify-between text-xs font-bold text-[#FFD700] group-hover:underline">
              <span>Explore Artist Roster</span>
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        </div>
      </section>

      {/* ── 4. FEATURED LUXURY VENUES (TRANSPARENT TARIFFS & PAX) ─────────── */}
      <section className="relative z-10 py-16 px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD700]/10 px-3 py-1 text-xs font-bold text-[#FFD700] border border-[#FFD700]/20 uppercase tracking-widest">
              <Building className="h-3.5 w-3.5" />
              <span>Handpicked Destinations</span>
            </div>
            <h2 className="font-outfit text-3xl sm:text-4xl font-black text-white mt-2">
              Featured Luxury Venues
            </h2>
            <p className="text-slate-300 text-sm mt-1">
              Verified availability, upfront transparent pricing, and confirmed technical load-in specs.
            </p>
          </div>

          <Link
            href="/venues"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#FFD700] hover:underline"
          >
            <span>View All 450+ Venues</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Venue 1 */}
          <div className="rounded-3xl border border-white/10 bg-[#141416] overflow-hidden flex flex-col justify-between hover:border-[#FFD700]/50 transition-all shadow-xl group">
            <div>
              <div className="h-48 w-full relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop"
                  alt="Jaipur Palace"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 rounded-full bg-black/70 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-white flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#FFD700]" />
                  <span>Jaipur, Rajasthan</span>
                </span>
                <span className="absolute bottom-3 right-3 rounded-full bg-[#FFD700] text-black px-2.5 py-1 text-[11px] font-bold">
                  ₹5,20,000 / day
                </span>
              </div>
              <div className="p-5 space-y-2">
                <h3 className="font-outfit text-lg font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  The Grand Imperial Fort
                </h3>
                <p className="text-xs text-slate-400">
                  Authentic heritage palace with royal courtyards, fountain lawn, and grand chandeliers.
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-300 pt-2 font-mono">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-[#FFD700]" />
                    <span>1,200 Pax</span>
                  </span>
                  <span>Heritage Lawn</span>
                </div>
              </div>
            </div>
            <div className="p-5 pt-0">
              <Link
                href="/app"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#FFD700]/40 bg-[#FFD700]/10 py-2.5 text-xs font-bold text-[#FFD700] hover:bg-[#FFD700] hover:text-black transition-all"
              >
                <span>Book via Web App</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Venue 2 */}
          <div className="rounded-3xl border border-white/10 bg-[#141416] overflow-hidden flex flex-col justify-between hover:border-[#FFD700]/50 transition-all shadow-xl group">
            <div>
              <div className="h-48 w-full relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop"
                  alt="Goa Beachfront"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 rounded-full bg-black/70 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-white flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#FFD700]" />
                  <span>North Goa</span>
                </span>
                <span className="absolute bottom-3 right-3 rounded-full bg-[#FFD700] text-black px-2.5 py-1 text-[11px] font-bold">
                  ₹4,80,000 / day
                </span>
              </div>
              <div className="p-5 space-y-2">
                <h3 className="font-outfit text-lg font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  Seaside Horizon Lawn
                </h3>
                <p className="text-xs text-slate-400">
                  Open-air oceanfront lawns with private beach access, sunset deck, and breezy cabanas.
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-300 pt-2 font-mono">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-[#FFD700]" />
                    <span>450 Pax</span>
                  </span>
                  <span>Beachfront</span>
                </div>
              </div>
            </div>
            <div className="p-5 pt-0">
              <Link
                href="/app"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#FFD700]/40 bg-[#FFD700]/10 py-2.5 text-xs font-bold text-[#FFD700] hover:bg-[#FFD700] hover:text-black transition-all"
              >
                <span>Book via Web App</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Venue 3 */}
          <div className="rounded-3xl border border-white/10 bg-[#141416] overflow-hidden flex flex-col justify-between hover:border-[#FFD700]/50 transition-all shadow-xl group">
            <div>
              <div className="h-48 w-full relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop"
                  alt="Delhi Convention Arena"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 rounded-full bg-black/70 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-white flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#FFD700]" />
                  <span>Aerocity, Delhi</span>
                </span>
                <span className="absolute bottom-3 right-3 rounded-full bg-[#FFD700] text-black px-2.5 py-1 text-[11px] font-bold">
                  ₹12,00,000 / day
                </span>
              </div>
              <div className="p-5 space-y-2">
                <h3 className="font-outfit text-lg font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  Imperial Convention Arena
                </h3>
                <p className="text-xs text-slate-400">
                  Massive pillarless arena with 20m ceiling height, heavy truss rigging, and 500 kVA dual DG.
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-300 pt-2 font-mono">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-[#FFD700]" />
                    <span>3,000 Pax</span>
                  </span>
                  <span>Mega Arena</span>
                </div>
              </div>
            </div>
            <div className="p-5 pt-0">
              <Link
                href="/app"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#FFD700]/40 bg-[#FFD700]/10 py-2.5 text-xs font-bold text-[#FFD700] hover:bg-[#FFD700] hover:text-black transition-all"
              >
                <span>Book via Web App</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Venue 4 */}
          <div className="rounded-3xl border border-white/10 bg-[#141416] overflow-hidden flex flex-col justify-between hover:border-[#FFD700]/50 transition-all shadow-xl group">
            <div>
              <div className="h-48 w-full relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=800&auto=format&fit=crop"
                  alt="Raipur Imperial Lawn"
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 rounded-full bg-black/70 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-white flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[#FFD700]" />
                  <span>Raipur, CG</span>
                </span>
                <span className="absolute bottom-3 right-3 rounded-full bg-[#FFD700] text-black px-2.5 py-1 text-[11px] font-bold">
                  ₹3,50,000 / day
                </span>
              </div>
              <div className="p-5 space-y-2">
                <h3 className="font-outfit text-lg font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  The Grand Imperial Lawn
                </h3>
                <p className="text-xs text-slate-400">
                  Manicured emerald green lawn with 125 kVA 3-phase power and air-conditioned banquet wing.
                </p>
                <div className="flex items-center gap-4 text-xs text-slate-300 pt-2 font-mono">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-[#FFD700]" />
                    <span>650 Pax</span>
                  </span>
                  <span>Lawn &amp; Hall</span>
                </div>
              </div>
            </div>
            <div className="p-5 pt-0">
              <Link
                href="/app"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[#FFD700]/40 bg-[#FFD700]/10 py-2.5 text-xs font-bold text-[#FFD700] hover:bg-[#FFD700] hover:text-black transition-all"
              >
                <span>Book via Web App</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. INTERACTIVE 3D STAGE & LIGHTING EXPERIENCE ──────────────────── */}
      <section className="relative z-10 py-12 px-6 lg:px-8 max-w-7xl mx-auto">
        <Interactive3DStage />
      </section>

      {/* ── 6. HOW IT WORKS (3 SIMPLE, FRIENDLY STEPS) ──────────────────────── */}
      <section className="relative z-10 py-20 lg:py-28 px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD700]/10 px-3.5 py-1 text-xs font-bold text-[#FFD700] border border-[#FFD700]/20 uppercase tracking-widest">
            <HeartHandshake className="h-3.5 w-3.5" />
            <span>Stress-Free Planning</span>
          </div>
          <h2 className="font-outfit text-3xl sm:text-5xl font-black text-white">
            How It Works in 3 Easy Steps
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Planning a celebration shouldn&apos;t feel stressful. We make finding venues, booking specialists, and executing your day effortless.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="rounded-3xl border border-white/10 bg-[#141416] p-8 space-y-5 text-center relative overflow-hidden group hover:border-[#FFD700]/50 transition-all">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30 font-outfit text-xl font-black">
              1
            </div>
            <h3 className="font-outfit text-2xl font-bold text-white">
              Share Your Vision &amp; Dates
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Tell us your target destination, guest count, and event style. Launch our web app for interactive 3D layout planning or message our WhatsApp bot.
            </p>
            <div className="pt-2 text-xs text-[#FFD700] font-medium flex items-center justify-center gap-1">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Instant budget estimations</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="rounded-3xl border border-white/10 bg-[#141416] p-8 space-y-5 text-center relative overflow-hidden group hover:border-[#FFD700]/50 transition-all">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30 font-outfit text-xl font-black">
              2
            </div>
            <h3 className="font-outfit text-2xl font-bold text-white">
              Pick Venues &amp; Specialists
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Explore verified 5-star venue photos, real pricing, and certified catering/sound specialists. Lock dates with zero guesswork and complete transparency.
            </p>
            <div className="pt-2 text-xs text-[#FFD700] font-medium flex items-center justify-center gap-1">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>100% verified KYC contractors</span>
            </div>
          </div>

          {/* Step 3 */}
          <div className="rounded-3xl border border-white/10 bg-[#141416] p-8 space-y-5 text-center relative overflow-hidden group hover:border-[#FFD700]/50 transition-all">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFD700]/15 text-[#FFD700] border border-[#FFD700]/30 font-outfit text-xl font-black">
              3
            </div>
            <h3 className="font-outfit text-2xl font-bold text-white">
              Celebrate with Peace of Mind
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Our on-ground production director oversees soundcheck, vendor coordination, and timelines. Payments stay safe in our 25/50/25 milestone escrow.
            </p>
            <div className="pt-2 text-xs text-[#FFD700] font-medium flex items-center justify-center gap-1">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Dedicated on-site director</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. THE WEB APP DIGITAL STUDIO PREVIEW ───────────────────────────── */}
      <section className="relative z-10 py-16 px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>The Eventalogy Digital Studio</span>
            </div>
            <h2 className="font-outfit text-3xl sm:text-5xl font-black text-white leading-tight">
              All 3D Drafting, Reverse Bidding &amp; Contracts Live in the Web App.
            </h2>
            <p className="text-slate-300 text-base leading-relaxed">
              When you launch our web app, you unlock the complete operational command center. No app downloads
              required — everything works smoothly in your desktop or mobile browser.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFD700]/15 text-[#FFD700] shrink-0 mt-0.5">
                  <Layers className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Interactive 3D Seating &amp; Stage Layout</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Drag-and-drop banquet tables, stage risers, lighting trusses, and guest seating with instant capacity math.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFD700]/15 text-[#FFD700] shrink-0 mt-0.5">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Direct Reverse Vendor Bidding</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Verified sound, lighting, and catering contractors submit itemized proposals for your dates — saving you up to 25%.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0 mt-0.5">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">25/50/25 Milestone Escrow Protection</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Your money stays locked safely: 25% to book, 50% on soundcheck setup, and 25% only after successful event sign-off.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-wrap items-center gap-4">
              <Link
                href="/app"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#FFF0A8] px-6 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-black shadow-lg hover:brightness-110 active:scale-95 transition-all"
              >
                <span>Launch Web App Studio</span>
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <span className="text-xs text-slate-400 font-mono">100% Free to Explore &bull; Zero Installation</span>
            </div>
          </div>

          {/* Right Visual Box */}
          <div className="lg:col-span-6">
            <TiltCard
              glareColor="rgba(255, 215, 0, 0.25)"
              className="border border-[#FFD700]/30 bg-[#101012] p-5 shadow-2xl space-y-4"
            >
              {/* Window Controls */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 px-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500/80"></span>
                  <span className="h-3 w-3 rounded-full bg-yellow-500/80"></span>
                  <span className="h-3 w-3 rounded-full bg-green-500/80"></span>
                  <span className="ml-2 font-mono text-xs text-slate-400">app.eventology.in/studio</span>
                </div>
                <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400">
                  STUDIO ACTIVE
                </span>
              </div>

              {/* Graphic Mockup */}
              <div className="rounded-xl border border-white/10 bg-black/70 p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">Grand Courtyard &amp; Royal Pavilion</p>
                    <p className="text-xs text-slate-400">Venue Capacity: 1,200 Pax &bull; Current Layout: 780 Seats</p>
                  </div>
                  <span className="rounded bg-[#FFD700]/20 border border-[#FFD700]/30 px-2.5 py-1 text-xs font-bold text-[#FFD700]">
                    STAGE OK
                  </span>
                </div>

                <div className="h-48 rounded-lg bg-[#141416] border border-white/10 relative flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:18px_18px]" />
                  <div className="relative text-center space-y-2">
                    <div className="mx-auto h-12 w-52 rounded-xl border border-[#FFD700]/60 bg-[#FFD700]/20 flex items-center justify-center text-xs font-bold text-[#FFD700]">
                      MAIN PERFORMANCE STAGE (45x22 ft)
                    </div>
                    <div className="flex justify-center gap-2 pt-1">
                      <span className="h-4 w-4 rounded-full bg-blue-500/30 border border-blue-400/50"></span>
                      <span className="h-4 w-4 rounded-full bg-blue-500/30 border border-blue-400/50"></span>
                      <span className="h-4 w-4 rounded-full bg-blue-500/30 border border-blue-400/50"></span>
                      <span className="h-4 w-4 rounded-full bg-blue-500/30 border border-blue-400/50"></span>
                      <span className="h-4 w-4 rounded-full bg-blue-500/30 border border-blue-400/50"></span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono">
                      48 VIP Tables &bull; Dual Line Arrays &bull; 4K LED Backdrop
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-[10px] text-slate-400">Escrow Locked</p>
                    <p className="font-bold text-white">₹42,50,000</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-[10px] text-slate-400">Live Bids</p>
                    <p className="font-bold text-[#FFD700]">16 Verified</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-[10px] text-slate-400">Day-Of Timeline</p>
                    <p className="font-bold text-emerald-400">On Track</p>
                  </div>
                </div>
              </div>
            </TiltCard>
          </div>
        </div>
      </section>

      {/* ── 8. FULL PLANNING CONCIERGE BANNER (JUST LIKE SETMYEVENT) ───────── */}
      <section className="relative z-10 py-16 px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="rounded-3xl border border-[#FFD700]/40 bg-gradient-to-r from-[#1E1A10] via-[#141416] to-[#1E1A10] p-10 sm:p-14 lg:p-16 space-y-6 shadow-[0_20px_60px_rgba(255,215,0,0.15)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#FFD700]/20 px-4 py-1.5 text-xs font-bold text-[#FFD700] border border-[#FFD700]/30">
            <Sparkles className="h-4 w-4" />
            <span>FULL-SERVICE EVENT CONCIERGE</span>
          </div>

          <h2 className="font-outfit text-3xl sm:text-5xl font-black text-white max-w-3xl mx-auto leading-tight">
            Want Our Team to Handle Everything from Start to Finish?
          </h2>

          <p className="mx-auto max-w-2xl text-slate-300 text-sm sm:text-base leading-relaxed">
            Sit back and relax. Our senior directors curate venues, negotiate vendor contracts, run soundchecks, and coordinate day-of execution on site.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={() => setCallbackModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#FFF0A8] px-7 py-3.5 font-outfit text-xs sm:text-sm font-bold uppercase tracking-wider text-black shadow-xl hover:brightness-110 active:scale-95 transition-all"
            >
              <PhoneCall className="h-4 w-4" />
              <span>Request a Call Back</span>
            </button>

            <a
              href="https://wa.me/917714009000?text=Hi%20Eventalogy!%20I%20would%20like%20to%20plan%20an%20event."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-7 py-3.5 font-outfit text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/20 transition-all"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Chat on WhatsApp</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
