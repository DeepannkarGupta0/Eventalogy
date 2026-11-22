"use client";

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
  Zap,
  RotateCw,
} from "lucide-react";

import ThreeBackground from "@/components/ThreeBackground";
import TiltCard from "@/components/TiltCard";
import Interactive3DStage from "@/components/Interactive3DStage";

export default function HomePage() {
  return (
    <div className="relative min-h-screen bg-[#070709] text-white overflow-hidden">
      {/* ── 0. THREE.JS 3D WEBGL BACKGROUND CANVAS ──────────────────────────── */}
      <ThreeBackground />

      {/* ── 1. HERO SECTION & 3 GATEWAY HUBS ─────────────────────────────────── */}
      <section className="relative z-10 px-6 lg:px-8 pt-12 pb-24 md:pt-16 md:pb-32 max-w-7xl mx-auto space-y-12">
        {/* Top Floating Badge */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 py-1.5 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
            <Sparkles className="h-4 w-4 text-[#FFD700]" />
            <span className="font-syne text-xs sm:text-sm font-bold tracking-wider text-[#FFD700] uppercase">
              Eventalogy International &bull; Royal Weddings &bull; Concerts &bull; Global Summits
            </span>
          </div>

          {/* Monumental Headline */}
          <h1 className="mt-6 font-syne text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.08]">
            Curating <span className="gold-gradient-text">Extraordinary</span> Celebrations &amp; Stadium Experiences.
          </h1>

          {/* Friendly Subtitle */}
          <p className="mt-6 mx-auto max-w-3xl text-base sm:text-xl text-slate-300 leading-relaxed font-normal">
            Whether you are planning a royal destination wedding, a stadium concert, or a luxury corporate gala,{" "}
            <span className="text-white font-semibold">Eventalogy International</span> is your complete event production
            partner. Enter our digital web app, chat with our automated bots, or connect with our on-ground directors.
          </p>
        </div>

        {/* ── THE 3 INTERACTIVE 3D GATEWAY CARDS ──────────────────────────────── */}
        <div id="gateways" className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Gateway 1: Web App Studio */}
          <TiltCard
            glareColor="rgba(212, 175, 55, 0.35)"
            className="border border-[#D4AF37]/40 bg-gradient-to-b from-[#161B28] to-[#0A0D15] p-8 shadow-2xl flex flex-col justify-between hover:border-[#FFD700] group"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#D4AF37]/20 border border-[#D4AF37]/40 text-[#FFD700] shadow-md group-hover:scale-110 transition-transform">
                  <Laptop className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-[#10B981]/15 px-3 py-1 text-[11px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
                  INSTANT IN-BROWSER
                </span>
              </div>
              <h2 className="font-syne text-2xl font-bold text-white group-hover:text-[#FFD700] transition-colors">
                Web App Studio
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Open our full interactive workspace. Design 3D floorplans, browse 450+ verified venues, receive live
                itemized vendor bids, and manage milestone payments.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-white/10">
              <Link
                href="/app"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#FFD700] py-3.5 text-xs font-bold uppercase tracking-wider text-black shadow-lg hover:brightness-110 active:scale-95 transition-all"
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
              <h2 className="font-syne text-2xl font-bold text-white group-hover:text-emerald-300 transition-colors">
                WhatsApp Concierge
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Connect directly with our WhatsApp assistant. Get instant budget estimates, check venue date
                availabilities, and chat with our senior event production architects.
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
              <h2 className="font-syne text-2xl font-bold text-white group-hover:text-pink-300 transition-colors">
                Instagram &amp; Reels
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Explore real event footage, behind-the-scenes stage lighting, celebrity artist concerts, and floral
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
      <section className="relative z-10 border-y border-white/10 bg-[#0B0D14]/80 backdrop-blur-md py-8 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <p className="font-syne text-3xl font-extrabold text-[#FFD700]">1,200+</p>
            <p className="text-xs text-slate-300 font-medium">Curated Luxury Events</p>
          </div>
          <div className="space-y-1">
            <p className="font-syne text-3xl font-extrabold text-white">450+</p>
            <p className="text-xs text-slate-300 font-medium">Handpicked Palaces &amp; Arenas</p>
          </div>
          <div className="space-y-1">
            <p className="font-syne text-3xl font-extrabold text-emerald-400">100%</p>
            <p className="text-xs text-slate-300 font-medium">Milestone Escrow Security</p>
          </div>
          <div className="space-y-1">
            <p className="font-syne text-3xl font-extrabold text-white">4.95 / 5</p>
            <p className="text-xs text-slate-300 font-medium">Verified Client Satisfaction</p>
          </div>
        </div>
      </section>

      {/* ── 3. WHAT WE DO (THE 4 PILLARS) ──────────────────────────────────── */}
      <section id="what-we-do" className="relative z-10 py-20 lg:py-28 px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
        <div className="text-center space-y-4 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#D4AF37]/10 px-3.5 py-1 text-xs font-bold text-[#FFD700] border border-[#D4AF37]/20 uppercase tracking-widest">
            <Crown className="h-3.5 w-3.5" />
            <span>End-to-End Production</span>
          </div>
          <h2 className="font-syne text-3xl sm:text-5xl font-black text-white">
            What We Take Care of For You
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            Forget running around 20 different contractors. Eventalogy International unifies venues, stage production,
            decor, gourmet dining, and on-ground management under one trusted team.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pillar 1 */}
          <div className="rounded-2xl border border-white/10 bg-[#10131E] p-6 space-y-4 hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#FFD700] border border-[#D4AF37]/30">
                <Building className="h-6 w-6" />
              </div>
              <h3 className="font-syne text-xl font-bold text-white">Curated Luxury Venues</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Heritage palaces in Rajasthan, private beachfront lawns in Goa, and grand convention arenas in Delhi &amp; Mumbai with confirmed dates and clear load-in permits.
              </p>
            </div>
            <Link href="/venues" className="inline-flex items-center gap-1 text-xs font-bold text-[#FFD700] hover:underline pt-3 border-t border-white/10">
              <span>View Venue Catalog</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Pillar 2 */}
          <div className="rounded-2xl border border-white/10 bg-[#10131E] p-6 space-y-4 hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#FFD700] border border-[#D4AF37]/30">
                <Palette className="h-6 w-6" />
              </div>
              <h3 className="font-syne text-xl font-bold text-white">Thematic Decor &amp; Floral Art</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Royal mandap architecture, illuminated entrance tunnels, crystal chandeliers, ambient tree fairy lighting, and fresh imported floral artistry.
              </p>
            </div>
            <Link href="/vendors" className="inline-flex items-center gap-1 text-xs font-bold text-[#FFD700] hover:underline pt-3 border-t border-white/10">
              <span>View Decor Portfolios</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Pillar 3 */}
          <div className="rounded-2xl border border-white/10 bg-[#10131E] p-6 space-y-4 hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#FFD700] border border-[#D4AF37]/30">
                <Speaker className="h-6 w-6" />
              </div>
              <h3 className="font-syne text-xl font-bold text-white">Concert Audio, Light &amp; AV</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                JBL VTX / L-Acoustics line array systems, grandMA3 intelligent beam lights, 4K high-refresh LED walls, silent DG power, and certified sound engineers.
              </p>
            </div>
            <Link href="/vendors" className="inline-flex items-center gap-1 text-xs font-bold text-[#FFD700] hover:underline pt-3 border-t border-white/10">
              <span>Explore Technical Specs</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Pillar 4 */}
          <div className="rounded-2xl border border-white/10 bg-[#10131E] p-6 space-y-4 hover:border-[#D4AF37]/50 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#FFD700] border border-[#D4AF37]/30">
                <UtensilsCrossed className="h-6 w-6" />
              </div>
              <h3 className="font-syne text-xl font-bold text-white">Royal Banquets &amp; Catering</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Curated multi-cuisine feasts, live artisan food counters, cocktail mixology bars, uniformed white-glove staff, and FSSAI-certified kitchen standards.
              </p>
            </div>
            <Link href="/vendors" className="inline-flex items-center gap-1 text-xs font-bold text-[#FFD700] hover:underline pt-3 border-t border-white/10">
              <span>Explore Menus &amp; Bars</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 4. INTERACTIVE 3D STAGE & LIGHTING EXPERIENCE ──────────────────── */}
      <section className="relative z-10 py-12 px-6 lg:px-8 max-w-7xl mx-auto">
        <Interactive3DStage />
      </section>

      {/* ── 5. THE WEB APP EXPERIENCE PREVIEW ──────────────────────────────── */}
      <section className="relative z-10 py-20 lg:py-28 px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>The Eventalogy Digital Studio</span>
            </div>
            <h2 className="font-syne text-3xl sm:text-5xl font-black text-white leading-tight">
              All Booking, 3D Drafting &amp; Planning Lives Inside the Web App.
            </h2>
            <p className="text-slate-300 text-base leading-relaxed">
              When you launch our web app, you unlock the complete operational command center for your event. No downloads
              needed — everything works smoothly on any desktop or mobile browser.
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D4AF37]/15 text-[#FFD700] shrink-0 mt-0.5">
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
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D4AF37]/15 text-[#FFD700] shrink-0 mt-0.5">
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
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#FFD700] px-6 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-black shadow-lg hover:brightness-110 active:scale-95 transition-all"
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
              glareColor="rgba(212, 175, 55, 0.25)"
              className="border border-[#D4AF37]/30 bg-[#0C0F17] p-5 shadow-2xl space-y-4"
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
                  <span className="rounded bg-[#D4AF37]/20 border border-[#D4AF37]/30 px-2.5 py-1 text-xs font-bold text-[#FFD700]">
                    STAGE OK
                  </span>
                </div>

                <div className="h-48 rounded-lg bg-[#121622] border border-white/10 relative flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:18px_18px]" />
                  <div className="relative text-center space-y-2">
                    <div className="mx-auto h-12 w-52 rounded-xl border border-[#FFD700]/60 bg-[#D4AF37]/20 flex items-center justify-center text-xs font-bold text-[#FFD700]">
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

      {/* ── 6. HOW YOU CAN REACH US / OMNICHANNEL GATEWAY ───────────────────── */}
      <section className="relative z-10 border-t border-white/10 bg-[#090B12]/80 backdrop-blur-md py-20 lg:py-28 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <span className="text-xs font-bold tracking-widest text-[#FFD700] uppercase font-mono">
              DIRECT ACCESS CHANNELS
            </span>
            <h2 className="font-syne text-3xl sm:text-5xl font-black text-white">
              Connect With Us Anywhere, Anytime.
            </h2>
            <p className="text-slate-300 text-sm sm:text-base">
              Start your planning journey through your preferred channel. Our automated assistants and production team
              are ready 24/7.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Box 1 */}
            <div className="rounded-3xl border border-[#D4AF37]/30 bg-[#121622] p-8 space-y-5 text-center flex flex-col justify-between">
              <div className="space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D4AF37]/20 text-[#FFD700] border border-[#D4AF37]/40">
                  <Laptop className="h-7 w-7" />
                </div>
                <h3 className="font-syne text-2xl font-bold text-white">In-Browser Web Studio</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The complete DIY &amp; professional workspace. Draft floorplans, review contractor manifests, and book
                  with 100% milestone protection.
                </p>
              </div>
              <Link
                href="/app"
                className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FFD700] hover:underline pt-4 border-t border-white/10"
              >
                <span>Launch Web Studio</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Box 2 */}
            <div className="rounded-3xl border border-emerald-500/30 bg-[#0E1A17] p-8 space-y-5 text-center flex flex-col justify-between">
              <div className="space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <MessageCircle className="h-7 w-7" />
                </div>
                <h3 className="font-syne text-2xl font-bold text-white">WhatsApp Bot Assistant</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Message our intelligent WhatsApp bot to receive quick budget breakdowns, check date availability, and
                  get instant quotes directly on your phone.
                </p>
              </div>
              <a
                href="https://wa.me/917714009000?text=Hi%20Eventalogy!%20I%20would%20like%20to%20plan%20an%20event."
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 hover:underline pt-4 border-t border-white/10"
              >
                <span>Chat on WhatsApp</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* Box 3 */}
            <div className="rounded-3xl border border-pink-500/30 bg-[#1A0E18] p-8 space-y-5 text-center flex flex-col justify-between">
              <div className="space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/20 text-pink-400 border border-pink-500/40">
                  <Instagram className="h-7 w-7" />
                </div>
                <h3 className="font-syne text-2xl font-bold text-white">Instagram Inspiration</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Watch our latest event reels, grand mandap lighting, live concerts, and drop a direct message to trigger
                  our Instagram concierge.
                </p>
              </div>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-pink-400 hover:underline pt-4 border-t border-white/10"
              >
                <span>Follow &amp; Message</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. GRAND CALL TO ACTION ──────────────────────────────────────────── */}
      <section className="relative z-10 py-20 lg:py-28 px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="rounded-3xl border border-[#D4AF37]/40 bg-gradient-to-r from-[#1E1609] via-[#10131E] to-[#1E1609] p-10 sm:p-16 lg:p-20 space-y-8 shadow-[0_20px_60px_rgba(212,175,55,0.2)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37]/20 px-4 py-1.5 text-xs font-bold text-[#FFD700] border border-[#FFD700]/30">
            <Sparkles className="h-4 w-4" />
            <span>LET&apos;S CREATE MAGIC TOGETHER</span>
          </div>

          <h2 className="font-syne text-3xl sm:text-5xl lg:text-6xl font-black text-white max-w-4xl mx-auto leading-tight">
            Ready to Plan an Unforgettable Celebration?
          </h2>

          <p className="mx-auto max-w-2xl text-slate-300 text-sm sm:text-base leading-relaxed">
            Enter the Eventalogy Web App to build your custom plan, chat with our automated bot on WhatsApp, or speak
            directly with our senior event directors.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/app"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#AA820A] px-8 py-4 font-syne text-sm sm:text-base font-bold uppercase tracking-wider text-black shadow-xl hover:brightness-110 active:scale-95 transition-all"
            >
              <Laptop className="h-5 w-5" />
              <span>Enter Web App Studio</span>
              <ArrowUpRight className="h-5 w-5" />
            </Link>

            <a
              href="https://wa.me/917714009000?text=Hi%20Eventalogy!%20I%20would%20like%20to%20plan%20an%20event."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-8 py-4 font-syne text-sm sm:text-base font-bold uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/20 transition-all"
            >
              <MessageCircle className="h-5 w-5" />
              <span>Chat on WhatsApp</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
