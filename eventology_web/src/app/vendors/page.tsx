import Link from "next/link";
import { CheckCircle2, Star, ShieldCheck, ArrowRight, Speaker, Zap, Sparkles, Utensils } from "lucide-react";

const vendorsCatalog = [
  {
    id: "vnd-sound-pro",
    name: "Acoustic Dynamics Audio Labs",
    category: "CONCERT AUDIO & PA",
    tier: "TIER 5 KYC VERIFIED",
    rating: "4.95",
    pricing: "Starting at ₹85,000 / day",
    manifest: "16x JBL VTX Line Array • Crown I-Tech 12000HD • Soundcraft Vi3000 • Shure Axient Digital",
    crewCount: "12 Certified Sound Engineers",
    powerDraw: "65 kVA 3-Phase",
    image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "vnd-light-truss",
    name: "Lumina Intelligent Truss & Rigging",
    category: "LIGHTING & TRUSSING",
    tier: "TIER 5 KYC VERIFIED",
    rating: "4.92",
    pricing: "Starting at ₹1,10,000 / day",
    manifest: "grandMA3 Full Size • 32x Robe MegaPointe • 24x Martin MAC Viper • Eurotruss FD34 Alloy",
    crewCount: "16 Rigging Technicians",
    powerDraw: "110 kVA 3-Phase",
    image: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "vnd-royal-catering",
    name: "Mewar Royal Banquets & Hospitality",
    category: "ROYAL CATERING FLEET",
    tier: "FSSAI & KYC VERIFIED",
    rating: "4.98",
    pricing: "From ₹2,200 / plate",
    manifest: "Mobile Cold-Chain Fleets • 120 Uniformed Staff • ISO 22000 Certified Kitchens",
    crewCount: "120 Service Staff",
    powerDraw: "30 kVA Kitchen DG",
    image: "https://images.unsplash.com/photo-1555244162-803834f70033?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "vnd-dg-power",
    name: "Silent-Gen Industrial Power & Cabling",
    category: "TEMPORARY POWER & DGs",
    tier: "TIER 4 KYC VERIFIED",
    rating: "4.89",
    pricing: "Starting at ₹45,000 / day",
    manifest: "2x 250 kVA Cummins Silent DG • Automatic Transfer Switch (ATS) • 500m 4-Core Copper Camlock",
    crewCount: "6 Licensed Electricians",
    powerDraw: "500 kVA Generation",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "vnd-led-wall",
    name: "Apex Pixel P2.6 UHD LED Displays",
    category: "VIDEO & LED SCREENS",
    tier: "TIER 5 KYC VERIFIED",
    rating: "4.94",
    pricing: "Starting at ₹95,000 / day",
    manifest: "100 m² Unilumin P2.6 Curve LED • NovaStar MX40 Pro • 4K Barco Event Master Processor",
    crewCount: "8 Video Engineers",
    powerDraw: "45 kVA 3-Phase",
    image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "vnd-mandap-decor",
    name: "Kashi Vastra Architectural Mandaps",
    category: "LUXURY DECOR & FABRIC",
    tier: "TIER 5 KYC VERIFIED",
    rating: "4.97",
    pricing: "From ₹4,50,000 / setup",
    manifest: "FR-Certified Fire-Retardant Velvets • Structural Steel Pillar Bases • Brass Carvings",
    crewCount: "35 Craftsmen & Riggers",
    powerDraw: "15 kVA Ambient Glow",
    image: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=800&auto=format&fit=crop",
  },
];

export default function VendorsPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.eventology.in";

  return (
    <div className="py-12 md:py-20 px-6 lg:px-8 space-y-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
        <div>
          <span className="rounded-md bg-[#10B981]/15 px-3 py-1 text-xs font-bold tracking-widest text-[#10B981] border border-[#10B981]/30 uppercase">
            5-Tier KYC Audited Contractors
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-3">
            Production Crews & Gear Fleets
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl">
            Tender reverse-auction bids to verified line-array audio engineers, intelligent moving head lighting crews, and heavy staging contractors.
          </p>
        </div>

        <a
          href={`${appUrl}/become-vendor`}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-bold text-white hover:bg-white/15 border border-white/15 transition-all self-start md:self-auto"
        >
          <span>Apply as Contractor</span>
          <ArrowRight className="h-4 w-4 text-[#FFD700]" />
        </a>
      </div>

      {/* Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {vendorsCatalog.map((vendor) => (
          <div
            key={vendor.id}
            className="group rounded-3xl border border-white/10 bg-[#121624] overflow-hidden hover:border-white/20 transition-all shadow-xl flex flex-col"
          >
            {/* Image */}
            <div className="relative h-56 w-full overflow-hidden bg-slate-900">
              <img
                src={vendor.image}
                alt={vendor.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute top-4 left-4 flex items-center gap-1 rounded-md bg-[#10B981] px-2.5 py-1 text-[10px] font-bold text-white shadow-md">
                <ShieldCheck className="h-3 w-3" />
                <span>{vendor.tier}</span>
              </div>
              <div className="absolute top-4 right-4 flex items-center gap-1 rounded-md bg-black/75 backdrop-blur-md px-2.5 py-1 text-xs font-bold text-white">
                <Star className="h-3.5 w-3.5 text-[#FFD700] fill-[#FFD700]" />
                <span>{vendor.rating}</span>
              </div>
            </div>

            {/* Content */}
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

                <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                  <span>Crew: {vendor.crewCount}</span>
                  <span>Load: {vendor.powerDraw}</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    Base Day Rate
                  </div>
                  <div className="text-sm font-bold text-[#FFD700]">{vendor.pricing}</div>
                </div>
                <a
                  href={`${appUrl}/vendors`}
                  className="rounded-lg bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition-colors"
                >
                  Request 60s RFQ
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
