import Link from "next/link";
import {
  Search,
  Calendar,
  Users,
  MapPin,
  Sparkles,
  ShieldCheck,
  Building2,
  Cpu,
  Layers,
  ArrowRight,
  Gavel,
  Lock,
  Star,
  CheckCircle2,
  FileCode2,
  Laptop,
  Smartphone,
  ExternalLink,
  Zap,
} from "lucide-react";
import ScaleEstimator from "@/components/ScaleEstimator";

const featuredVenues = [
  {
    id: "v-raipur-imperial",
    name: "The Grand Imperial Lawn & Palace",
    city: "Raipur, Chhattisgarh",
    capacity: "650 Pax",
    tariff: "₹3,50,000 / day",
    verified: true,
    image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=800&auto=format&fit=crop",
    tags: ["Open Lawn", "Ballroom", "125 kVA Power"],
  },
  {
    id: "v-bilaspur-heritage",
    name: "Royal Heritage Fort & Convention",
    city: "Bilaspur, Chhattisgarh",
    capacity: "1,200 Pax",
    tariff: "₹5,20,000 / day",
    verified: true,
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop",
    tags: ["Heritage Fort", "200 kVA DG", "NBC Certified"],
  },
  {
    id: "v-bhilai-arena",
    name: "Mayfair Arena & Amphitheatre",
    city: "Bhilai, Chhattisgarh",
    capacity: "2,500 Pax",
    tariff: "₹7,50,000 / day",
    verified: true,
    image: "https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=800&auto=format&fit=crop",
    tags: ["Concert Ground", "Line Array Truss", "3-Phase 250A"],
  },
];

const featuredVendors = [
  {
    id: "vnd-sound-pro",
    name: "Acoustic Dynamics Audio Labs",
    category: "CONCERT AUDIO & PA",
    tier: "TIER 5 KYC VERIFIED",
    rating: "4.95",
    pricing: "Starting at ₹85,000 / day",
    manifest: "16x JBL VTX Line Array • Crown I-Tech 12000HD • Soundcraft Vi3000",
    image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "vnd-light-truss",
    name: "Lumina Intelligent Truss & Rigging",
    category: "LIGHTING & TRUSSING",
    tier: "TIER 5 KYC VERIFIED",
    rating: "4.92",
    pricing: "Starting at ₹1,10,000 / day",
    manifest: "grandMA3 Full Size • 32x Robe MegaPointe • Eurotruss FD34 Alloy",
    image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "vnd-royal-catering",
    name: "Mewar Royal Banquets & Hospitality",
    category: "ROYAL CATERING FLEET",
    tier: "FSSAI & KYC VERIFIED",
    rating: "4.98",
    pricing: "From ₹2,200 / plate",
    manifest: "Mobile Cold-Chain Fleets • 120 Trained Uniformed Staff • ISO 22000",
    image: "https://images.unsplash.com/photo-1555244162-803834f70033?q=80&w=800&auto=format&fit=crop",
  },
];

export default function HomePage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.eventology.in";

  return (
    <div className="space-y-24 md:space-y-32 pb-24">
      {/* ── 1. Hero Section ──────────────────────────────────────────────── */}
      <section className="relative pt-12 md:pt-20 lg:pt-24 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Top Pill Badges */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="flex items-center gap-1.5 rounded-full border border-[#FFD700]/30 bg-[#FFD700]/10 px-3.5 py-1 text-xs font-bold text-[#FFD700] tracking-wider uppercase">
              <Sparkles className="h-3.5 w-3.5" />
              Flagship Enterprise Event Platform
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-[#10B981]/30 bg-[#10B981]/10 px-3.5 py-1 text-xs font-bold text-[#10B981] tracking-wider uppercase">
              <ShieldCheck className="h-3.5 w-3.5" />
              NBC 2016 Certified Spatial Engine
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white max-w-5xl leading-[1.1]">
            The Deterministic Event Production{" "}
            <span className="gold-gradient-text">& Engineering</span> Platform
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-3xl leading-relaxed">
            Institutional event architecture for high-stakes corporate galas, stadium concerts, and luxury weddings.
            Engineered with OpenCV blueprint vectorizers, NBC 2016 life safety proofs, and 25/50/25 milestone escrow.
          </p>

          {/* Direct Web App Quick Launchers */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/app"
              className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FFD700] to-[#E6B800] px-7 py-3.5 text-base font-bold text-black shadow-[0_0_25px_rgba(255,215,0,0.3)] hover:brightness-110 transition-all"
            >
              <span>Launch In-Browser Web App</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/venues"
              className="flex items-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-base font-medium text-white hover:bg-white/10 transition-all"
            >
              <Search className="h-4 w-4 text-[#FFD700]" />
              <span>Explore Verified Venues</span>
            </Link>
          </div>

          {/* ── Universal Search Dock ────────────────────────────────────── */}
          <div className="mt-10 rounded-3xl border border-white/15 bg-[#121624]/90 p-4 shadow-2xl backdrop-blur-2xl max-w-5xl">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
              {/* Event Type */}
              <div className="px-4 py-2 border-b md:border-b-0 md:border-r border-white/10">
                <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Event Format
                </label>
                <div className="flex items-center gap-2 mt-1 font-bold text-white text-sm">
                  <span>Luxury Wedding</span>
                </div>
              </div>

              {/* City */}
              <div className="px-4 py-2 border-b md:border-b-0 md:border-r border-white/10">
                <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Destination City
                </label>
                <div className="flex items-center gap-2 mt-1 font-bold text-white text-sm">
                  <MapPin className="h-4 w-4 text-[#FFD700]" />
                  <span>Raipur, India</span>
                </div>
              </div>

              {/* Guests */}
              <div className="px-4 py-2 border-b md:border-b-0 md:border-r border-white/10">
                <label className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Attendance Scale
                </label>
                <div className="flex items-center gap-2 mt-1 font-bold text-white text-sm">
                  <Users className="h-4 w-4 text-[#10B981]" />
                  <span>350+ Guests</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="p-1">
                <Link
                  href="/venues"
                  className="flex items-center justify-center gap-2 w-full rounded-2xl bg-gradient-to-r from-[#FFD700] to-[#E6B800] py-4 text-sm font-bold text-black shadow-[0_0_25px_rgba(255,215,0,0.3)] hover:brightness-110 transition-all"
                >
                  <Search className="h-4 w-4" />
                  <span>Search Catalogs</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Quick Filter Badges */}
          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            <span className="text-xs font-semibold text-slate-500">Popular:</span>
            {[
              "Heritage Palaces",
              "Open Lawns",
              "Concert Line Arrays",
              "Moving Heads & Truss",
              "Royal Catering",
              "Architectural Mandaps",
            ].map((tag) => (
              <Link
                key={tag}
                href="/venues"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 hover:border-white/25 hover:text-white transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 2. Trust Metrics Bar ─────────────────────────────────────────── */}
      <section className="border-y border-white/10 bg-[#0A0D15]/60 py-8 px-6 lg:px-8">
        <div className="mx-auto max-w-7xl grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white">₹50M+</div>
            <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">
              Escrow Protected
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[#10B981]">100%</div>
            <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">
              NBC 2016 Compliant
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-[#FFD700]">5-Tier</div>
            <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">
              Institutional KYC
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-white">Zero</div>
            <div className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">
              AI Hallucinations
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Deep-Tech Engineering Primitives Grid ────────────────────── */}
      <section className="px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <span className="text-xs font-bold tracking-widest text-[#FFD700] uppercase">
              Core Engineering Primitives
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-2">
              Built on Mathematical & Structural Reality
            </h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base leading-relaxed">
              No conversational AI chatbot prompts. Eventology operates strictly through deterministic computer vision,
              occupancy egress calculations, and automated multi-vendor tenders.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Primitive 1 */}
            <div className="group rounded-3xl border border-white/10 bg-[#10131E] p-7 hover:border-[#FFD700]/40 transition-all shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFD700]/15 text-[#FFD700]">
                    <FileCode2 className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
                    OPENCV ENGINE
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  Metric Blueprint Vectorizer
                </h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Transforms paper blueprints into editable Draw.io / CAD layers with automatic perimeter, pillar, and exit door segmentation.
                </p>
              </div>
              <Link
                href="/technology"
                className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-[#FFD700] hover:underline"
              >
                <span>Read Vector Specs</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Primitive 2 */}
            <div className="group rounded-3xl border border-white/10 bg-[#10131E] p-7 hover:border-[#10B981]/40 transition-all shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#10B981]/15 text-[#10B981]">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
                    NBC 2016 PART 4
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-bold text-white group-hover:text-[#10B981] transition-colors">
                  Life Safety Proofs
                </h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Verifies 30m maximum exit travel limits and 50 persons/unit width door capacities to mathematically prevent crowd disasters.
                </p>
              </div>
              <Link
                href="/technology"
                className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-[#10B981] hover:underline"
              >
                <span>Verify Egress Formula</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Primitive 3 */}
            <div className="group rounded-3xl border border-white/10 bg-[#10131E] p-7 hover:border-[#FFD700]/40 transition-all shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFD700]/15 text-[#FFD700]">
                    <Gavel className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
                    60s BLIND RFQ
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-bold text-white group-hover:text-[#FFD700] transition-colors">
                  Reverse Auction Matrix
                </h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Verified sound, lighting, and trussing providers submit blind line-item bids in integer Paise with automated GST calculations.
                </p>
              </div>
              <Link
                href="/vendors"
                className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-[#FFD700] hover:underline"
              >
                <span>Explore Bidding Engine</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Primitive 4 */}
            <div className="group rounded-3xl border border-white/10 bg-[#10131E] p-7 hover:border-[#3B82F6]/40 transition-all shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#3B82F6]/15 text-[#3B82F6]">
                    <Lock className="h-6 w-6" />
                  </div>
                  <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
                    ESCROW LEDGER
                  </span>
                </div>
                <h3 className="mt-6 text-xl font-bold text-white group-hover:text-[#3B82F6] transition-colors">
                  25/50/25 Milestone Payouts
                </h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  Funds released at contract signing (25%), loading dock QR arrival and soundcheck (50%), and event strike signoff (25%).
                </p>
              </div>
              <Link
                href="/escrow"
                className="mt-6 inline-flex items-center gap-1.5 text-xs font-bold text-[#3B82F6] hover:underline"
              >
                <span>Escrow Schedule</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3.5. Web App & Multi-Screen Parity Showcase ───────────────────── */}
      <section className="px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-[#FFD700]/30 bg-gradient-to-br from-[#121624] via-[#0D101C] to-[#121624] p-8 md:p-14 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-[#FFD700]/5 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-xs font-mono font-bold tracking-widest text-[#FFD700] uppercase">
                  Zero Download • Cloud Architecture
                </span>
              </div>

              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                Run the Whole Production from Your <span className="gold-gradient-text">Web Browser</span>
              </h2>

              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Eventology is not just a marketing catalog — it is a deterministic web-based operating system. Open it instantly on your desktop monitor to vectorize venue blueprints, solve NBC 2016 fire egress distances, and tender reverse auctions to certified crews.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <Laptop className="h-4 w-4 text-[#FFD700]" />
                    <span>Desktop Web Studio</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    1320px ultra-wide responsive canvas, multi-window layout, SAT geometry solver, and live reverse auction bidding.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <Smartphone className="h-4 w-4 text-emerald-400" />
                    <span>Mobile PWA & Android</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    On-site production mode: crew dispatch, walkie-talkie channel, dB audio checks, and escrow milestone QR releases.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <Link
                  href="/app"
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#E6B800] px-7 py-3.5 text-sm font-bold text-black shadow-[0_0_25px_rgba(255,215,0,0.3)] hover:brightness-110 transition-all"
                >
                  <span>Open Web App Gateway</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href={appUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
                >
                  <span>Direct Web App Link</span>
                  <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                </a>
              </div>
            </div>

            {/* Visual Frame of the Web App */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-white/15 bg-black/80 p-3 shadow-2xl backdrop-blur-xl">
                {/* Browser bar */}
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5 mb-3 px-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500/80"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/80"></div>
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500/80"></div>
                  </div>
                  <div className="rounded-md bg-white/5 border border-white/5 px-3 py-0.5 text-[10px] font-mono text-slate-400">
                    app.eventology.in/venues
                  </div>
                  <div className="h-2 w-2"></div>
                </div>

                {/* Simulated Screen */}
                <div className="rounded-xl bg-[#090C15] border border-white/5 p-4 space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-400 text-[11px]">
                    <span className="text-[#FFD700] font-bold">EVENTOLOGY STUDIO WEB</span>
                    <span className="text-emerald-400">CONNECTED (LIVE)</span>
                  </div>

                  <div className="rounded-lg bg-white/5 p-3 space-y-2 border border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300 font-sans text-xs font-bold">The Grand Imperial Lawn</span>
                      <span className="text-[10px] text-emerald-400 font-sans font-semibold">Verified Venue</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-sans">
                      Blueprint Vectorized: 18,500 sq.ft • NBC 2016 Compliant
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="rounded bg-black/40 p-2 border border-white/5">
                      <div className="text-slate-500">POWER DRAW</div>
                      <div className="font-bold text-white mt-0.5">85 kW / 125 kVA</div>
                    </div>
                    <div className="rounded bg-black/40 p-2 border border-white/5">
                      <div className="text-slate-500">ESCROW LOCK</div>
                      <div className="font-bold text-[#FFD700] mt-0.5">₹87,500 (25%)</div>
                    </div>
                  </div>

                  <Link
                    href="/app"
                    className="block text-center rounded-lg bg-[#FFD700] py-2 text-[11px] font-bold text-black font-sans hover:brightness-110 transition-all"
                  >
                    Launch In-Browser Studio →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Featured Venues Showcase ──────────────────────────────────── */}
      <section className="px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <span className="text-xs font-bold tracking-widest text-[#FFD700] uppercase">
                Curated Spaces
              </span>
              <h2 className="text-3xl font-extrabold text-white tracking-tight mt-1">
                Featured Venues & Palaces
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Verified ballrooms, heritage forts, and open grounds with metric Draw.io floorplan models.
              </p>
            </div>
            <Link
              href="/venues"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#FFD700] hover:underline"
            >
              <span>View All Venues</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredVenues.map((venue) => (
              <div
                key={venue.id}
                className="group rounded-3xl border border-white/10 bg-[#121624] overflow-hidden hover:border-white/20 transition-all shadow-xl flex flex-col"
              >
                {/* Image */}
                <div className="relative h-60 w-full overflow-hidden bg-slate-900">
                  <img
                    src={venue.image}
                    alt={venue.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4 flex items-center gap-1 rounded-md bg-[#10B981] px-2.5 py-1 text-[10px] font-bold text-white shadow-md">
                    <ShieldCheck className="h-3 w-3" />
                    <span>NBC VERIFIED</span>
                  </div>
                  <div className="absolute top-4 right-4 rounded-md bg-black/75 backdrop-blur-md px-3 py-1 text-xs font-bold text-white">
                    {venue.capacity}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-[#FFD700] transition-colors">
                      {venue.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-400 flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-[#FFD700]" />
                      <span>{venue.city}</span>
                    </p>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {venue.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300 border border-white/5"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        Estimated Tariff
                      </div>
                      <div className="text-sm font-bold text-[#FFD700]">{venue.tariff}</div>
                    </div>
                    <a
                      href={`${appUrl}/venues`}
                      className="rounded-lg bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition-colors"
                    >
                      View CAD Model
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. Verified Production Crews ─────────────────────────────────── */}
      <section className="px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
            <div>
              <span className="text-xs font-bold tracking-widest text-[#10B981] uppercase">
                Technical Execution
              </span>
              <h2 className="text-3xl font-extrabold text-white tracking-tight mt-1">
                Verified Production Crews
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                5-Tier KYC audited audio engineers, lighting masters, and heavy rigging contractors.
              </p>
            </div>
            <Link
              href="/vendors"
              className="inline-flex items-center gap-2 text-sm font-bold text-[#FFD700] hover:underline"
            >
              <span>View All Contractors</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            {featuredVendors.map((vendor) => (
              <div
                key={vendor.id}
                className="group rounded-3xl border border-white/10 bg-[#121624] overflow-hidden hover:border-white/20 transition-all shadow-xl flex flex-col"
              >
                <div className="relative h-52 w-full overflow-hidden bg-slate-900">
                  <img
                    src={vendor.image}
                    alt={vendor.name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4 flex items-center gap-1 rounded-md bg-[#10B981] px-2.5 py-1 text-[10px] font-bold text-white shadow-md">
                    <CheckCircle2 className="h-3 w-3" />
                    <span>{vendor.tier}</span>
                  </div>
                  <div className="absolute top-4 right-4 flex items-center gap-1 rounded-md bg-black/75 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-white">
                    <Star className="h-3.5 w-3.5 text-[#FFD700] fill-[#FFD700]" />
                    <span>{vendor.rating}</span>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-[#FFD700] uppercase">
                      {vendor.category}
                    </span>
                    <h3 className="mt-1 text-lg font-bold text-white group-hover:text-[#FFD700] transition-colors">
                      {vendor.name}
                    </h3>
                    <p className="mt-2 text-xs text-slate-400 font-mono leading-relaxed line-clamp-2">
                      {vendor.manifest}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                        Base Day Tariff
                      </div>
                      <div className="text-sm font-bold text-[#FFD700]">{vendor.pricing}</div>
                    </div>
                    <a
                      href={`${appUrl}/vendors`}
                      className="rounded-lg bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition-colors"
                    >
                      Request RFQ
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Interactive Scale & Fire Safety Estimator ─────────────────── */}
      <section className="px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <ScaleEstimator />
        </div>
      </section>

      {/* ── 7. Call To Action Banner ─────────────────────────────────────── */}
      <section className="px-6 lg:px-8">
        <div className="mx-auto max-w-7xl rounded-3xl border border-[#FFD700]/30 bg-gradient-to-r from-[#181F30] via-[#121624] to-[#181F30] p-10 md:p-16 text-center relative overflow-hidden shadow-2xl">
          <div className="relative z-10 max-w-3xl mx-auto space-y-6">
            <span className="rounded-full bg-[#FFD700]/15 px-4 py-1.5 text-xs font-bold tracking-widest text-[#FFD700] border border-[#FFD700]/30 uppercase">
              Start Your Production
            </span>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              Ready to Engineer Your Next High-Stakes Event?
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Launch your event production studio in 60 seconds. Generate verified CAD floorplans, certify municipal life-safety code compliance, and tender equipment tenders with institutional escrow protection.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/app"
                className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-[#FFD700] to-[#E6B800] px-8 py-4 text-base font-bold text-black shadow-[0_0_30px_rgba(255,215,0,0.35)] hover:brightness-110 transition-all"
              >
                Launch Web App Studio
              </Link>
              <Link
                href="/venues"
                className="w-full sm:w-auto rounded-xl border border-white/20 px-8 py-4 text-base font-bold text-white hover:bg-white/5 transition-all"
              >
                Explore Venue Database
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
