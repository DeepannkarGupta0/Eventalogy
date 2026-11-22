"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  MapPin,
  Users,
  ShieldCheck,
  Star,
  CheckCircle2,
  Crown,
  Music,
  Briefcase,
  GlassWater,
  Building,
  Palette,
  Speaker,
  UtensilsCrossed,
  Camera,
  Layers,
  PhoneCall,
  Search,
  Lock,
} from "lucide-react";

export default function HomePage() {
  // Quick Search Bar state
  const [eventType, setEventType] = useState("wedding");
  const [destination, setDestination] = useState("jaipur");
  const [guests, setGuests] = useState("500");

  // Interactive Event Cost Calculator state
  const [calcGuests, setCalcGuests] = useState<number>(650);
  const [calcTier, setCalcTier] = useState<"classic" | "luxury" | "royal">("luxury");
  const [calcType, setCalcType] = useState<"wedding" | "concert" | "corporate">("wedding");

  // Multipliers for calculator
  const tierMultiplier = calcTier === "classic" ? 1.0 : calcTier === "luxury" ? 1.8 : 3.2;
  const typeMultiplier = calcType === "wedding" ? 1.2 : calcType === "concert" ? 1.5 : 1.0;

  const costPerGuestFood = Math.round(1800 * tierMultiplier);
  const totalFood = Math.round((costPerGuestFood * calcGuests) / 100000); // In Lakhs
  const totalDecor = Math.round(12 * tierMultiplier * typeMultiplier); // In Lakhs
  const totalAV = Math.round(8 * tierMultiplier * typeMultiplier); // In Lakhs
  const totalVenue = Math.round(15 * tierMultiplier); // In Lakhs
  const totalBudgetLakhs = totalFood + totalDecor + totalAV + totalVenue;
  const recommendedAreaSqFt = calcGuests * 18;

  return (
    <div className="relative overflow-hidden bg-[#070709] text-white">
      {/* ── 1. HERO SECTION ─────────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex flex-col justify-center px-6 lg:px-8 pt-12 pb-20 overflow-hidden">
        {/* Background glow & subtle ambient lighting */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(212,175,55,0.22),rgba(255,255,255,0))]" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] bg-[#D4AF37]/10 blur-[140px] pointer-events-none rounded-full" />

        <div className="relative mx-auto max-w-7xl w-full text-center space-y-8 z-10">
          {/* Top Pill Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 py-1.5 shadow-[0_0_20px_rgba(212,175,55,0.2)]">
            <Sparkles className="h-4 w-4 text-[#FFD700]" />
            <span className="font-syne text-xs sm:text-sm font-bold tracking-wider text-[#FFD700] uppercase">
              Eventalogy International &bull; Luxury Event Planning &amp; Production
            </span>
          </div>

          {/* Monumental Headline */}
          <h1 className="font-syne text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-white max-w-5xl mx-auto leading-[1.08]">
            Curating <span className="gold-gradient-text">Extraordinary</span> Celebrations &amp; Stadium Experiences.
          </h1>

          {/* Subtitle */}
          <p className="mx-auto max-w-3xl text-base sm:text-xl text-slate-300 leading-relaxed font-normal">
            From royal destination weddings and palace galas to massive music festivals and global corporate summits —{" "}
            <span className="text-white font-semibold">Eventalogy International</span> connects you with iconic luxury
            venues, vetted five-star vendors, and an all-in-one digital studio for effortless execution.
          </p>

          {/* Dual Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/venues"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#AA820A] px-7 py-4 font-syne text-sm sm:text-base font-bold uppercase tracking-wider text-black shadow-[0_0_30px_rgba(212,175,55,0.4)] hover:brightness-110 active:scale-95 transition-all"
            >
              <span>Explore Venues &amp; Vendors</span>
              <ArrowRight className="h-5 w-5" />
            </Link>

            <Link
              href="/app"
              className="flex items-center gap-2 rounded-xl border border-[#D4AF37]/40 bg-[#10131E]/90 backdrop-blur-md px-7 py-4 font-syne text-sm sm:text-base font-bold uppercase tracking-wider text-white shadow-lg hover:bg-[#161B28] hover:border-[#FFD700] transition-all group"
            >
              <Sparkles className="h-5 w-5 text-[#FFD700] group-hover:scale-110 transition-transform" />
              <span>Launch Web App Studio</span>
              <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-white" />
            </Link>
          </div>

          {/* ── INTERACTIVE QUICK EVENT FINDER SEARCH BAR ── */}
          <div className="mx-auto max-w-4xl pt-6">
            <div className="rounded-2xl border border-[rgba(212,175,55,0.25)] bg-[#10131E]/80 backdrop-blur-xl p-4 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-left">
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-center">
                {/* Event Type */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Occasion</span>
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value)}
                    className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFD700]"
                  >
                    <option value="wedding">Royal Destination Wedding</option>
                    <option value="concert">Music Festival &amp; Concert</option>
                    <option value="corporate">Corporate Summit &amp; Gala</option>
                    <option value="private">Luxury Private Celebration</option>
                  </select>
                </div>

                {/* Destination */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>Destination</span>
                  </label>
                  <select
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFD700]"
                  >
                    <option value="jaipur">Jaipur &amp; Rajasthan</option>
                    <option value="goa">Goa &amp; Coastal</option>
                    <option value="mumbai">Mumbai &amp; Western India</option>
                    <option value="delhi">Delhi NCR &amp; North</option>
                    <option value="dubai">Dubai &amp; Emirates</option>
                    <option value="london">London &amp; Europe</option>
                  </select>
                </div>

                {/* Guest Count */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    <span>Guests</span>
                  </label>
                  <select
                    value={guests}
                    onChange={(e) => setGuests(e.target.value)}
                    className="w-full rounded-lg bg-black/60 border border-white/10 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFD700]"
                  >
                    <option value="250">100 - 300 Guests (Boutique)</option>
                    <option value="500">300 - 800 Guests (Grand)</option>
                    <option value="1500">800 - 2,500 Guests (Palace)</option>
                    <option value="5000">2,500+ Guests (Mega Scale)</option>
                  </select>
                </div>

                {/* Search Button */}
                <div className="sm:col-span-3 lg:col-span-1 pt-1 sm:pt-0">
                  <Link
                    href={`/venues?type=${eventType}&city=${destination}&guests=${guests}`}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#FFD700] py-3 px-4 font-syne text-xs font-bold uppercase tracking-wider text-black shadow-md hover:brightness-110 transition-all"
                  >
                    <Search className="h-4 w-4" />
                    <span>Find Venues</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. TRUST & SCALE STATISTICS STRIP ───────────────────────────────── */}
      <section className="border-y border-white/10 bg-[#0B0D14] py-10 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div className="space-y-1">
            <p className="font-syne text-3xl sm:text-4xl font-extrabold text-[#FFD700]">1,200+</p>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">Curated Luxury Events</p>
          </div>
          <div className="space-y-1">
            <p className="font-syne text-3xl sm:text-4xl font-extrabold text-white">450+</p>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">Verified Palaces &amp; Arenas</p>
          </div>
          <div className="space-y-1">
            <p className="font-syne text-3xl sm:text-4xl font-extrabold text-[#10B981]">100%</p>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">Escrow Milestone Protected</p>
          </div>
          <div className="space-y-1">
            <p className="font-syne text-3xl sm:text-4xl font-extrabold text-white">4.95 / 5</p>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">Verified Client Satisfaction</p>
          </div>
        </div>
      </section>

      {/* ── 3. EVENTS WE CRAFT (EXPERIENCES) ─────────────────────────────────── */}
      <section className="py-20 lg:py-28 px-6 lg:px-8 max-w-7xl mx-auto space-y-16">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#D4AF37]/10 px-3.5 py-1 text-xs font-bold text-[#FFD700] border border-[#D4AF37]/20 uppercase tracking-widest">
            <Crown className="h-3.5 w-3.5" />
            <span>Signature Experiences</span>
          </div>
          <h2 className="font-syne text-3xl sm:text-5xl font-black text-white">
            What Kind of Event Are You Planning?
          </h2>
          <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
            Whether it is an intimate royal palace wedding or a stadium with 50,000 fans, our global production teams
            and verified vendors deliver perfection.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Weddings */}
          <div className="group relative rounded-2xl border border-white/10 bg-[#10131E] overflow-hidden hover:border-[#D4AF37]/50 transition-all hover:shadow-[0_10px_30px_rgba(212,175,55,0.15)] flex flex-col">
            <div className="h-56 w-full overflow-hidden relative">
              <img
                src="https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=800&auto=format&fit=crop"
                alt="Royal Destination Wedding"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#10131E] via-transparent to-black/40" />
              <span className="absolute top-3 left-3 rounded-md bg-black/70 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-[#FFD700] border border-[#FFD700]/30">
                ROYAL WEDDINGS
              </span>
            </div>
            <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-syne text-xl font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  Palaces &amp; Destination Weddings
                </h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Heritage fort takeovers, royal baraat coordination, bespoke mandap architecture, multi-day guest
                  hospitality, and celebrity performances.
                </p>
              </div>
              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-[#D4AF37] font-semibold">Rajasthan &bull; Goa &bull; Dubai</span>
                <Link href="/venues?type=wedding" className="text-white hover:underline flex items-center gap-1 font-bold">
                  <span>Explore</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Card 2: Concerts */}
          <div className="group relative rounded-2xl border border-white/10 bg-[#10131E] overflow-hidden hover:border-[#D4AF37]/50 transition-all hover:shadow-[0_10px_30px_rgba(212,175,55,0.15)] flex flex-col">
            <div className="h-56 w-full overflow-hidden relative">
              <img
                src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop"
                alt="Concert and Music Festival"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#10131E] via-transparent to-black/40" />
              <span className="absolute top-3 left-3 rounded-md bg-black/70 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-400/30">
                CONCERTS &amp; FESTIVALS
              </span>
            </div>
            <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-syne text-xl font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  Stadium Concerts &amp; Live Shows
                </h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Stadium-grade line arrays, grandMA intelligent lighting, pyro effects, heavy trussing, and strict
                  crowd egress safety.
                </p>
              </div>
              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-[#D4AF37] font-semibold">Arenas &bull; Grounds &bull; Expos</span>
                <Link href="/venues?type=concert" className="text-white hover:underline flex items-center gap-1 font-bold">
                  <span>Explore</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Card 3: Corporate */}
          <div className="group relative rounded-2xl border border-white/10 bg-[#10131E] overflow-hidden hover:border-[#D4AF37]/50 transition-all hover:shadow-[0_10px_30px_rgba(212,175,55,0.15)] flex flex-col">
            <div className="h-56 w-full overflow-hidden relative">
              <img
                src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop"
                alt="Corporate Summit & Gala"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#10131E] via-transparent to-black/40" />
              <span className="absolute top-3 left-3 rounded-md bg-black/70 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-blue-400 border border-blue-400/30">
                CORPORATE SUMMITS
              </span>
            </div>
            <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-syne text-xl font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  Global Summits &amp; Award Galas
                </h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Pillarless convention halls, immersive curved LED walls, keynote streaming, simultaneous translation,
                  and black-tie dinners.
                </p>
              </div>
              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-[#D4AF37] font-semibold">Mumbai &bull; Delhi &bull; London</span>
                <Link href="/venues?type=corporate" className="text-white hover:underline flex items-center gap-1 font-bold">
                  <span>Explore</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Card 4: Private Soiree */}
          <div className="group relative rounded-2xl border border-white/10 bg-[#10131E] overflow-hidden hover:border-[#D4AF37]/50 transition-all hover:shadow-[0_10px_30px_rgba(212,175,55,0.15)] flex flex-col">
            <div className="h-56 w-full overflow-hidden relative">
              <img
                src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=800&auto=format&fit=crop"
                alt="Luxury Private Soiree"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#10131E] via-transparent to-black/40" />
              <span className="absolute top-3 left-3 rounded-md bg-black/70 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-purple-400 border border-purple-400/30">
                VIP CELEBRATIONS
              </span>
            </div>
            <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-syne text-xl font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  Private Galas &amp; Milestone Soirees
                </h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  Milestone birthdays, private villa takeovers, yacht parties, Michelin-level culinary experiences, and
                  bespoke live music.
                </p>
              </div>
              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-[#D4AF37] font-semibold">Udaipur &bull; Goa &bull; Alibaug</span>
                <Link href="/venues?type=private" className="text-white hover:underline flex items-center gap-1 font-bold">
                  <span>Explore</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. 360° SERVICES UNDER ONE ROOF ─────────────────────────────────── */}
      <section className="border-t border-white/10 bg-[#0A0C13] py-20 lg:py-28 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[#D4AF37]/10 px-3.5 py-1 text-xs font-bold text-[#FFD700] border border-[#D4AF37]/20 uppercase tracking-widest">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Full-Stack Execution</span>
            </div>
            <h2 className="font-syne text-3xl sm:text-5xl font-black text-white">
              Everything Your Event Needs. Perfectly Coordinated.
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              Say goodbye to juggling 15 different vendors. Eventalogy International unifies venues, audio-visuals,
              decor, catering, and on-ground management under one verified roof.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Service 1 */}
            <div className="rounded-2xl border border-white/10 bg-[#121622] p-8 space-y-4 hover:border-[#D4AF37]/40 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#FFD700] border border-[#D4AF37]/30">
                <Building className="h-6 w-6" />
              </div>
              <h3 className="font-syne text-xl font-bold text-white">Curated Luxury Venues</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Handpicked heritage forts, 5-star ballrooms, beach resorts, and open lawns with guaranteed dates,
                verified capacities, and load-in permits.
              </p>
              <Link href="/venues" className="inline-flex items-center gap-1 text-xs font-bold text-[#FFD700] hover:underline pt-2">
                <span>Browse Venues</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Service 2 */}
            <div className="rounded-2xl border border-white/10 bg-[#121622] p-8 space-y-4 hover:border-[#D4AF37]/40 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#FFD700] border border-[#D4AF37]/30">
                <Palette className="h-6 w-6" />
              </div>
              <h3 className="font-syne text-xl font-bold text-white">Thematic Decor &amp; Floral Art</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Immersive set designers, bespoke mandap architecture, entrance tunnels, ambient canopy lighting, and
                fresh imported floral styling.
              </p>
              <Link href="/vendors" className="inline-flex items-center gap-1 text-xs font-bold text-[#FFD700] hover:underline pt-2">
                <span>View Decor Portfolios</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Service 3 */}
            <div className="rounded-2xl border border-white/10 bg-[#121622] p-8 space-y-4 hover:border-[#D4AF37]/40 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#FFD700] border border-[#D4AF37]/30">
                <Speaker className="h-6 w-6" />
              </div>
              <h3 className="font-syne text-xl font-bold text-white">Concert Audio, Light &amp; AV</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                JBL VTX / L-Acoustics line arrays, grandMA3 intelligent lighting, 4K high-refresh LED displays, silent
                DG backup generators, and certified sound engineers.
              </p>
              <Link href="/vendors" className="inline-flex items-center gap-1 text-xs font-bold text-[#FFD700] hover:underline pt-2">
                <span>Check Technical Specs</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Service 4 */}
            <div className="rounded-2xl border border-white/10 bg-[#121622] p-8 space-y-4 hover:border-[#D4AF37]/40 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#FFD700] border border-[#D4AF37]/30">
                <UtensilsCrossed className="h-6 w-6" />
              </div>
              <h3 className="font-syne text-xl font-bold text-white">Royal Banquets &amp; Gourmet Dining</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Curated multi-cuisine feasts, live artisan counters, authentic regional specialties, mobile cold-chain
                logistics, and premier cocktail mixology.
              </p>
              <Link href="/vendors" className="inline-flex items-center gap-1 text-xs font-bold text-[#FFD700] hover:underline pt-2">
                <span>Explore Menus</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Service 5 */}
            <div className="rounded-2xl border border-white/10 bg-[#121622] p-8 space-y-4 hover:border-[#D4AF37]/40 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#FFD700] border border-[#D4AF37]/30">
                <Camera className="h-6 w-6" />
              </div>
              <h3 className="font-syne text-xl font-bold text-white">Cinematography &amp; Drone Coverage</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Award-winning wedding cinematographers, 4K multi-cam live broadcast feeds, FPV drone footage, and
                same-day edit highlights.
              </p>
              <Link href="/vendors" className="inline-flex items-center gap-1 text-xs font-bold text-[#FFD700] hover:underline pt-2">
                <span>View Showreels</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Service 6 */}
            <div className="rounded-2xl border border-white/10 bg-[#121622] p-8 space-y-4 hover:border-[#D4AF37]/40 transition-colors">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#D4AF37]/10 text-[#FFD700] border border-[#D4AF37]/30">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="font-syne text-xl font-bold text-white">100% Escrow Milestone Vault</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Your payments are held in secure escrow and released in 3 safe stages: 25% to mobilize, 50% on soundcheck
                setup, and 25% only after event signoff.
              </p>
              <Link href="/escrow" className="inline-flex items-center gap-1 text-xs font-bold text-[#FFD700] hover:underline pt-2">
                <span>How Escrow Works</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. INTERACTIVE EVENT BUDGET ESTIMATOR ─────────────────────────────── */}
      <section className="py-20 lg:py-28 px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="rounded-3xl border border-[rgba(212,175,55,0.3)] bg-gradient-to-br from-[#121622] via-[#0E1017] to-[#070709] p-8 sm:p-12 lg:p-16 shadow-[0_20px_60px_rgba(0,0,0,0.9)] space-y-12">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <span className="text-xs font-bold tracking-widest text-[#FFD700] uppercase font-mono">
              INSTANT BUDGET ESTIMATOR
            </span>
            <h2 className="font-syne text-3xl sm:text-5xl font-black text-white">
              Calculate Your Event Budget in Real-Time
            </h2>
            <p className="text-slate-300 text-sm sm:text-base">
              Get an immediate realistic estimate for your celebration based on actual vendor tariffs and market benchmarks.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Controls */}
            <div className="lg:col-span-7 space-y-8">
              {/* Event Type Tabs */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Select Event Format:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setCalcType("wedding")}
                    className={`rounded-xl py-3 px-3 text-xs sm:text-sm font-bold transition-all ${
                      calcType === "wedding"
                        ? "bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    Royal Wedding
                  </button>
                  <button
                    onClick={() => setCalcType("concert")}
                    className={`rounded-xl py-3 px-3 text-xs sm:text-sm font-bold transition-all ${
                      calcType === "concert"
                        ? "bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    Music Concert
                  </button>
                  <button
                    onClick={() => setCalcType("corporate")}
                    className={`rounded-xl py-3 px-3 text-xs sm:text-sm font-bold transition-all ${
                      calcType === "corporate"
                        ? "bg-[#D4AF37] text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]"
                        : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    Corporate Gala
                  </button>
                </div>
              </div>

              {/* Guest Count Slider */}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-slate-200">Expected Guests:</span>
                  <span className="font-syne text-2xl font-black text-[#FFD700]">{calcGuests} Pax</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="3500"
                  step="50"
                  value={calcGuests}
                  onChange={(e) => setCalcGuests(Number(e.target.value))}
                  className="w-full accent-[#D4AF37] h-2 bg-white/20 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>100 VIP</span>
                  <span>1,000 Grand</span>
                  <span>2,000 Palace</span>
                  <span>3,500+ Mega</span>
                </div>
              </div>

              {/* Luxury Production Tier */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Production &amp; Decor Tier:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setCalcTier("classic")}
                    className={`rounded-xl py-3 px-2 text-xs font-bold transition-all border ${
                      calcTier === "classic"
                        ? "border-[#D4AF37] bg-[#D4AF37]/20 text-[#FFD700]"
                        : "border-white/10 bg-white/5 text-slate-400"
                    }`}
                  >
                    Grand Classic
                  </button>
                  <button
                    onClick={() => setCalcTier("luxury")}
                    className={`rounded-xl py-3 px-2 text-xs font-bold transition-all border ${
                      calcTier === "luxury"
                        ? "border-[#D4AF37] bg-[#D4AF37]/20 text-[#FFD700]"
                        : "border-white/10 bg-white/5 text-slate-400"
                    }`}
                  >
                    Luxury Deluxe (Popular)
                  </button>
                  <button
                    onClick={() => setCalcTier("royal")}
                    className={`rounded-xl py-3 px-2 text-xs font-bold transition-all border ${
                      calcTier === "royal"
                        ? "border-[#D4AF37] bg-[#D4AF37]/20 text-[#FFD700]"
                        : "border-white/10 bg-white/5 text-slate-400"
                    }`}
                  >
                    Royal Sovereign
                  </button>
                </div>
              </div>
            </div>

            {/* Right Result Card */}
            <div className="lg:col-span-5 rounded-2xl border border-[rgba(212,175,55,0.4)] bg-[#070709] p-6 sm:p-8 space-y-6 shadow-2xl">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-widest text-slate-400">
                  Estimated Total Budget
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-syne text-4xl sm:text-5xl font-black text-[#FFD700]">
                    ₹{totalBudgetLakhs} Lakhs
                  </span>
                  <span className="text-xs text-slate-400 font-mono">(&plusmn;8% variance)</span>
                </div>
              </div>

              {/* Itemized breakdown */}
              <div className="space-y-3 border-t border-b border-white/10 py-4 text-xs sm:text-sm">
                <div className="flex justify-between text-slate-300">
                  <span>Food &amp; Beverage ({calcGuests} pax):</span>
                  <span className="font-bold text-white">₹{totalFood} Lakhs</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Thematic Decor &amp; Floral Art:</span>
                  <span className="font-bold text-white">₹{totalDecor} Lakhs</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Concert Sound, Lighting &amp; Truss:</span>
                  <span className="font-bold text-white">₹{totalAV} Lakhs</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Venue &amp; Logistics Reserve:</span>
                  <span className="font-bold text-white">₹{totalVenue} Lakhs</span>
                </div>
                <div className="flex justify-between text-[#10B981] pt-1">
                  <span>Recommended Venue Footprint:</span>
                  <span className="font-bold">{recommendedAreaSqFt.toLocaleString()} sq. ft.</span>
                </div>
              </div>

              {/* CTA into Web App */}
              <div className="space-y-3">
                <Link
                  href={`/app?guests=${calcGuests}&type=${calcType}&tier=${calcTier}&budget=${totalBudgetLakhs}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#FFD700] py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-black shadow-lg hover:brightness-110 transition-all"
                >
                  <span>Build Itemized Plan in Web App</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <p className="text-[11px] text-center text-slate-400">
                  Customize vendors, floor plans, and secure your date with 25% milestone escrow.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. THE EVENTALOGY WEB APP (PLATFORM PREVIEW) ────────────────────── */}
      <section className="border-t border-white/10 bg-[#0A0C13] py-20 lg:py-28 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#10B981]/15 px-3.5 py-1 text-xs font-bold text-[#10B981] border border-[#10B981]/30">
                <span className="h-2 w-2 rounded-full bg-[#10B981] animate-pulse"></span>
                <span>The Eventalogy Web App Studio</span>
              </div>
              <h2 className="font-syne text-3xl sm:text-5xl font-black text-white leading-tight">
                The Digital Command Center for Your Event.
              </h2>
              <p className="text-slate-300 text-base leading-relaxed">
                Whether you are a bride, a corporate event lead, or an independent wedding planner, the{" "}
                <span className="text-white font-semibold">Eventalogy Web App</span> gives you total control without the
                headaches. Plan in 3D, compare vendor quotes, and manage payments safely in one place.
              </p>

              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D4AF37]/15 text-[#FFD700] shrink-0 mt-0.5">
                    <Layers className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Interactive 3D Seating &amp; Stage Planner</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Drag-and-drop tables, stage, buffet counters, and dance floor with automated guest capacity warnings.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D4AF37]/15 text-[#FFD700] shrink-0 mt-0.5">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">Instant Reverse Vendor Bidding</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Verified sound, light, and catering vendors bid for your event requirements — saving you up to 25%.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#10B981]/15 text-[#10B981] shrink-0 mt-0.5">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm">25/50/25 Milestone Escrow Vault</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Never worry about vendors not showing up. Money is released only as milestones are verified.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap items-center gap-4">
                <Link
                  href="/app"
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#FFD700] px-6 py-3.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-black shadow-lg hover:brightness-110 active:scale-95 transition-all"
                >
                  <span>Launch Web App Now</span>
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
                <span className="text-xs text-slate-400 font-mono">Zero downloads required &bull; Works on any browser</span>
              </div>
            </div>

            {/* Right Interactive Mockup */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl border border-[rgba(212,175,55,0.3)] bg-[#070709] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] space-y-4">
                {/* Mockup Topbar */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3 px-2">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-500/80"></span>
                    <span className="h-3 w-3 rounded-full bg-yellow-500/80"></span>
                    <span className="h-3 w-3 rounded-full bg-green-500/80"></span>
                    <span className="ml-2 font-mono text-xs text-slate-400">app.eventology.in/studio</span>
                  </div>
                  <span className="rounded bg-[#10B981]/15 px-2 py-0.5 text-[10px] font-mono font-bold text-[#10B981]">
                    LIVE SYNC
                  </span>
                </div>

                {/* Mockup Canvas */}
                <div className="rounded-xl border border-white/10 bg-[#121622] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-white">Grand Ballroom &amp; Royal Courtyard</p>
                      <p className="text-[11px] text-slate-400">Capacity: 850 Pax &bull; Current Layout: 620 Seats</p>
                    </div>
                    <span className="rounded-md bg-[#D4AF37]/20 border border-[#D4AF37]/30 px-2 py-1 text-[10px] font-bold text-[#FFD700]">
                      STAGE RIGGING OK
                    </span>
                  </div>

                  {/* Stage Grid Visual */}
                  <div className="h-44 rounded-lg bg-black/60 border border-white/10 relative flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:20px_20px]" />
                    <div className="relative text-center space-y-1">
                      <div className="mx-auto h-10 w-44 rounded border border-[#FFD700]/60 bg-[#D4AF37]/20 flex items-center justify-center text-[11px] font-bold text-[#FFD700]">
                        MAIN PERFORMANCE STAGE (40x20 ft)
                      </div>
                      <div className="flex justify-center gap-2 pt-2">
                        <span className="h-4 w-4 rounded-full bg-blue-500/30 border border-blue-400/50"></span>
                        <span className="h-4 w-4 rounded-full bg-blue-500/30 border border-blue-400/50"></span>
                        <span className="h-4 w-4 rounded-full bg-blue-500/30 border border-blue-400/50"></span>
                        <span className="h-4 w-4 rounded-full bg-blue-500/30 border border-blue-400/50"></span>
                        <span className="h-4 w-4 rounded-full bg-blue-500/30 border border-blue-400/50"></span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono pt-1">
                        45 VIP Round Tables &bull; 8 Acoustic Monitors &bull; Dual LED Walls
                      </p>
                    </div>
                  </div>

                  {/* Mockup Metrics Footer */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-white/5 p-2">
                      <p className="text-[10px] text-slate-400">Escrow Locked</p>
                      <p className="font-bold text-white">₹38,50,000</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-2">
                      <p className="text-[10px] text-slate-400">Bids Received</p>
                      <p className="font-bold text-[#FFD700]">14 Verified</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-2">
                      <p className="text-[10px] text-slate-400">Timeline</p>
                      <p className="font-bold text-[#10B981]">On Schedule</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. FEATURED LUXURY VENUES ────────────────────────────────────────── */}
      <section className="py-20 lg:py-28 px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <span className="text-xs font-bold tracking-widest text-[#FFD700] uppercase font-mono">
              CURATED DESTINATIONS
            </span>
            <h2 className="font-syne text-3xl sm:text-5xl font-black text-white">
              Handpicked Iconic Venues
            </h2>
          </div>
          <Link
            href="/venues"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[#FFD700] hover:underline"
          >
            <span>View All 450+ Venues</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Venue 1 */}
          <div className="rounded-2xl border border-white/10 bg-[#10131E] overflow-hidden group hover:border-[#D4AF37]/50 transition-all flex flex-col">
            <div className="h-60 w-full overflow-hidden relative">
              <img
                src="https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop"
                alt="The Grand Imperial Lawn & Palace"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute top-3 left-3 rounded-md bg-black/70 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-[#FFD700] border border-[#FFD700]/30">
                JAIPUR, RAJASTHAN
              </span>
            </div>
            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-syne text-xl font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  The Grand Imperial Fort &amp; Palace
                </h3>
                <p className="text-xs text-slate-300 mt-2">
                  Heritage palace with 4 royal courtyards, grand chandelier ballroom, helipad, and 1,200 Pax banquet lawn.
                </p>
              </div>
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Tariff:</span>
                  <span className="text-sm font-bold text-[#FFD700]">₹5,20,000 / day</span>
                </div>
                <Link
                  href="/venues?id=v-bilaspur-heritage"
                  className="rounded-lg bg-white/10 hover:bg-[#D4AF37] hover:text-black px-3.5 py-2 text-xs font-bold transition-all text-white"
                >
                  View Details
                </Link>
              </div>
            </div>
          </div>

          {/* Venue 2 */}
          <div className="rounded-2xl border border-white/10 bg-[#10131E] overflow-hidden group hover:border-[#D4AF37]/50 transition-all flex flex-col">
            <div className="h-60 w-full overflow-hidden relative">
              <img
                src="https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=800&auto=format&fit=crop"
                alt="Royal Heritage Fort & Convention"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute top-3 left-3 rounded-md bg-black/70 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-400/30">
                GOA COASTAL
              </span>
            </div>
            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-syne text-xl font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  The Royal Heritage Waterfront Lawn
                </h3>
                <p className="text-xs text-slate-300 mt-2">
                  Direct sunset beach access, open-air amphitheatre, 24-hour music permit, and 850 Pax capacity.
                </p>
              </div>
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Tariff:</span>
                  <span className="text-sm font-bold text-[#FFD700]">₹3,50,000 / day</span>
                </div>
                <Link
                  href="/venues?id=v-raipur-imperial"
                  className="rounded-lg bg-white/10 hover:bg-[#D4AF37] hover:text-black px-3.5 py-2 text-xs font-bold transition-all text-white"
                >
                  View Details
                </Link>
              </div>
            </div>
          </div>

          {/* Venue 3 */}
          <div className="rounded-2xl border border-white/10 bg-[#10131E] overflow-hidden group hover:border-[#D4AF37]/50 transition-all flex flex-col">
            <div className="h-60 w-full overflow-hidden relative">
              <img
                src="https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop"
                alt="Imperial Convention Arena"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute top-3 left-3 rounded-md bg-black/70 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-blue-400 border border-blue-400/30">
                AEROCITY, NEW DELHI
              </span>
            </div>
            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <div>
                <h3 className="font-syne text-xl font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  The Imperial Convention &amp; Expo Arena
                </h3>
                <p className="text-xs text-slate-300 mt-2">
                  Pillarless 20m high ceilings, 3,000 Pax convention floor, 500 kVA dual DG power, and 5-star airport hospitality.
                </p>
              </div>
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Tariff:</span>
                  <span className="text-sm font-bold text-[#FFD700]">₹12,00,000 / day</span>
                </div>
                <Link
                  href="/venues?id=v-delhi-convention"
                  className="rounded-lg bg-white/10 hover:bg-[#D4AF37] hover:text-black px-3.5 py-2 text-xs font-bold transition-all text-white"
                >
                  View Details
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. CLIENT STORIES & TESTIMONIALS ─────────────────────────────────── */}
      <section className="border-t border-white/10 bg-[#090B10] py-20 lg:py-28 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center space-y-4 max-w-2xl mx-auto">
            <span className="text-xs font-bold tracking-widest text-[#FFD700] uppercase font-mono">
              CLIENT TESTIMONIALS
            </span>
            <h2 className="font-syne text-3xl sm:text-5xl font-black text-white">
              Trusted by Royalty &amp; Industry Leaders
            </h2>
            <p className="text-slate-400 text-sm sm:text-base">
              See what families, event directors, and corporate leaders say about working with Eventalogy International.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-white/10 bg-[#10131E] p-8 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex gap-1 text-[#FFD700]">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-[#FFD700]" />
                  ))}
                </div>
                <p className="text-sm text-slate-200 leading-relaxed italic">
                  &ldquo;Eventalogy turned our 3-day royal wedding in Udaipur into an absolute fairytale. The floral
                  architecture, sound engineering, and guest coordination were seamless. Having our payments held safely
                  in milestone escrow gave our families complete peace of mind.&rdquo;
                </p>
              </div>
              <div className="pt-4 border-t border-white/10">
                <p className="font-bold text-white text-sm">Ananya &amp; Vikram Singhania</p>
                <p className="text-xs text-[#D4AF37]">Destination Wedding &bull; The Leela Palace, Udaipur</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#10131E] p-8 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex gap-1 text-[#FFD700]">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-[#FFD700]" />
                  ))}
                </div>
                <p className="text-sm text-slate-200 leading-relaxed italic">
                  &ldquo;We produced an international concert with 15,000 attendees. The audio line arrays, intelligent
                  lighting, and crowd egress protocols were top-tier stadium grade. Eventalogy is easily the most
                  professional production partner in the country.&rdquo;
                </p>
              </div>
              <div className="pt-4 border-t border-white/10">
                <p className="font-bold text-white text-sm">Rohan Merchant</p>
                <p className="text-xs text-[#D4AF37]">Festival Director &bull; Solaris Sunfest Mumbai</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#10131E] p-8 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex gap-1 text-[#FFD700]">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-[#FFD700]" />
                  ))}
                </div>
                <p className="text-sm text-slate-200 leading-relaxed italic">
                  &ldquo;Coordinating our Global Leadership Summit with 40 keynote speakers and 1,800 delegates required
                  pinpoint accuracy. The Eventalogy Web App made floor planning, vendor bidding, and day-of-event timing
                  effortless.&rdquo;
                </p>
              </div>
              <div className="pt-4 border-t border-white/10">
                <p className="font-bold text-white text-sm">Priya Sharma</p>
                <p className="text-xs text-[#D4AF37]">VP Global Marketing &bull; FinTech World Forum</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. GRAND CALL TO ACTION ──────────────────────────────────────────── */}
      <section className="py-20 lg:py-28 px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="rounded-3xl border border-[#D4AF37]/40 bg-gradient-to-r from-[#1E1609] via-[#10131E] to-[#1E1609] p-10 sm:p-16 lg:p-20 space-y-8 shadow-[0_20px_60px_rgba(212,175,55,0.2)]">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37]/20 px-4 py-1.5 text-xs font-bold text-[#FFD700] border border-[#FFD700]/30">
            <Sparkles className="h-4 w-4" />
            <span>LET&apos;S CREATE MAGIC TOGETHER</span>
          </div>

          <h2 className="font-syne text-3xl sm:text-5xl lg:text-6xl font-black text-white max-w-4xl mx-auto leading-tight">
            Ready to Plan an Unforgettable Celebration?
          </h2>

          <p className="mx-auto max-w-2xl text-slate-300 text-sm sm:text-base leading-relaxed">
            Connect with an Eventalogy International Senior Event Director or launch the web studio to start building
            your floor plan and receiving verified vendor proposals.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/app"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#AA820A] px-8 py-4 font-syne text-sm sm:text-base font-bold uppercase tracking-wider text-black shadow-xl hover:brightness-110 active:scale-95 transition-all"
            >
              <span>Start Planning in Web App</span>
              <ArrowUpRight className="h-5 w-5" />
            </Link>

            <Link
              href="/contact"
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-8 py-4 font-syne text-sm sm:text-base font-bold uppercase tracking-wider text-white hover:bg-white/10 transition-all"
            >
              <PhoneCall className="h-4 w-4 text-[#FFD700]" />
              <span>Talk to an Event Director</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
