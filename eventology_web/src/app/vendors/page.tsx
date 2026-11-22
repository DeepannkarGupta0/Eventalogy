"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Star, ShieldCheck, ArrowRight, Speaker, Zap, Sparkles, Utensils, Search } from "lucide-react";

const vendorsCatalog = [
  {
    id: "vnd-sound-pro",
    name: "Acoustic Dynamics Audio Labs",
    category: "CONCERT AUDIO & PA",
    categoryKey: "Audio",
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
    categoryKey: "Lighting",
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
    categoryKey: "Catering",
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
    categoryKey: "Power",
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
    categoryKey: "Video",
    tier: "TIER 5 KYC VERIFIED",
    rating: "4.94",
    pricing: "Starting at ₹95,000 / day",
    manifest: "100 m² Unilumin P2.6 Curve LED • NovaStar MX40 Pro • 4K Barco Event Master Processor",
    crewCount: "8 Video Technicians",
    powerDraw: "45 kVA 3-Phase",
    image: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "vnd-mandap-decor",
    name: "Vedic Craft Architectural Mandaps",
    category: "STAGING & ARCHITECTURAL DECOR",
    categoryKey: "Decor",
    tier: "TIER 5 KYC VERIFIED",
    rating: "4.97",
    pricing: "Starting at ₹2,50,000 / setup",
    manifest: "Structural Steel Frame • CNC Carved Wooden Facades • Fire-Retardant Fabric Linings",
    crewCount: "35 Artisans & Riggers",
    powerDraw: "20 kVA",
    image: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?q=80&w=800&auto=format&fit=crop",
  },
];

export default function VendorsPage() {
  const [selectedCat, setSelectedCat] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = ["All", "Audio", "Lighting", "Catering", "Power", "Video", "Decor"];

  const filteredVendors = vendorsCatalog.filter((vendor) => {
    const matchesCat = selectedCat === "All" || vendor.categoryKey === selectedCat;
    const matchesQuery =
      vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.manifest.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  return (
    <div className="py-12 md:py-20 px-6 lg:px-8 space-y-10 max-w-7xl mx-auto">
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

        <Link
          href="/app"
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#E6B800] px-5 py-3 text-sm font-bold text-black hover:brightness-110 transition-all self-start md:self-auto shadow-[0_0_20px_rgba(255,215,0,0.3)]"
        >
          <span>Tender Reverse Auction</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-white/10 bg-[#101422] p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search audio, lighting, catering, gear..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/40 pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FFD700]"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedCat === cat
                  ? "bg-[#FFD700] text-black shadow-md"
                  : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="text-xs text-slate-400">
        Showing <span className="font-bold text-white">{filteredVendors.length}</span> verified contractors
      </div>

      {/* Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredVendors.map((vendor) => (
          <div
            key={vendor.id}
            className="group rounded-3xl border border-white/10 bg-[#121624] overflow-hidden hover:border-[#FFD700]/30 transition-all shadow-xl flex flex-col justify-between"
          >
            {/* Image */}
            <div>
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
              <div className="p-6">
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
            </div>

            <div className="px-6 pb-6 pt-4 border-t border-white/10 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Base Day Rate
                </div>
                <div className="text-sm font-bold text-[#FFD700]">{vendor.pricing}</div>
              </div>
              <Link
                href="/app"
                className="rounded-lg bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#FFD700] hover:text-black transition-all"
              >
                Request 60s RFQ
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
