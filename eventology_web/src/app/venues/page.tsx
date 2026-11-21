import Link from "next/link";
import { MapPin, Users, ShieldCheck, ArrowRight, Zap, Volume2 } from "lucide-react";

const venuesCatalog = [
  {
    id: "v-raipur-imperial",
    name: "The Grand Imperial Lawn & Palace",
    city: "Raipur, Chhattisgarh",
    capacity: "650 Pax",
    tariff: "₹3,50,000 / day",
    verified: true,
    power: "125 kVA 3-Phase",
    curfew: "10:00 PM Municipal",
    image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=800&auto=format&fit=crop",
    tags: ["Open Lawn", "Grand Ballroom", "AC Banquet"],
  },
  {
    id: "v-bilaspur-heritage",
    name: "Royal Heritage Fort & Convention",
    city: "Bilaspur, Chhattisgarh",
    capacity: "1,200 Pax",
    tariff: "₹5,20,000 / day",
    verified: true,
    power: "200 kVA DG Backup",
    curfew: "10:00 PM Municipal",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop",
    tags: ["Heritage Fort", "Amphitheatre", "Helipad"],
  },
  {
    id: "v-bhilai-arena",
    name: "Mayfair Arena & Amphitheatre",
    city: "Bhilai, Chhattisgarh",
    capacity: "2,500 Pax",
    tariff: "₹7,50,000 / day",
    verified: true,
    power: "250A Main Feed",
    curfew: "10:30 PM Permitted",
    image: "https://images.unsplash.com/photo-1511578314322-379afb476865?q=80&w=800&auto=format&fit=crop",
    tags: ["Stadium Ground", "Concert Truss", "Heavy Rigging"],
  },
  {
    id: "v-delhi-convention",
    name: "Imperial Convention Arena",
    city: "Aerocity, New Delhi",
    capacity: "3,000 Pax",
    tariff: "₹12,00,000 / day",
    verified: true,
    power: "500 kVA Dual DG",
    curfew: "24-Hour Indoor Sound",
    image: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop",
    tags: ["Aero Hub", "Pillarless 20m Height", "Expo Floor"],
  },
  {
    id: "v-jaipur-palace",
    name: "Rajwada Palace & Royal Greens",
    city: "Jaipur, Rajasthan",
    capacity: "900 Pax",
    tariff: "₹8,50,000 / day",
    verified: true,
    power: "150 kVA 3-Phase",
    curfew: "10:00 PM Municipal",
    image: "https://images.unsplash.com/photo-1587271407850-8d438ca9fdf2?q=80&w=800&auto=format&fit=crop",
    tags: ["Heritage Courtyard", "Fountain Garden", "Sheesh Mahal"],
  },
  {
    id: "v-goa-beachfront",
    name: "Seaside Horizon Lawn & Pavilion",
    city: "North Goa",
    capacity: "450 Pax",
    tariff: "₹4,80,000 / day",
    verified: true,
    power: "100 kVA DG",
    curfew: "10:00 PM Coastal CRZ",
    image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop",
    tags: ["Beachfront Lawn", "Sunset Deck", "Coastal Resort"],
  },
];

export default function VenuesPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.eventology.in";

  return (
    <div className="py-12 md:py-20 px-6 lg:px-8 space-y-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
        <div>
          <span className="rounded-md bg-[#FFD700]/15 px-3 py-1 text-xs font-bold tracking-widest text-[#FFD700] border border-[#FFD700]/30 uppercase">
            Verified Physical Infrastructure
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-3">
            Venues, Palaces & Arenas
          </h1>
          <p className="mt-2 text-sm text-slate-400 max-w-2xl">
            Explore verified event grounds with documented 3-phase power kVA, loading dock vehicle clearances, acoustic curfews, and Draw.io CAD floorplans.
          </p>
        </div>

        <a
          href={`${appUrl}`}
          className="flex items-center gap-2 rounded-xl bg-[#FFD700] px-5 py-3 text-sm font-bold text-black hover:brightness-110 transition-all self-start md:self-auto"
        >
          <span>Open in Studio CAD</span>
          <ArrowRight className="h-4 w-4" />
        </a>
      </div>

      {/* Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {venuesCatalog.map((venue) => (
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
                <span>NBC 2016 VERIFIED</span>
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

                <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5 text-[#FFD700]" />
                    {venue.power}
                  </span>
                  <span className="flex items-center gap-1">
                    <Volume2 className="h-3.5 w-3.5 text-[#3B82F6]" />
                    {venue.curfew}
                  </span>
                </div>

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
                    Base Day Tariff
                  </div>
                  <div className="text-sm font-bold text-[#FFD700]">{venue.tariff}</div>
                </div>
                <a
                  href={`${appUrl}/venues`}
                  className="rounded-lg bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition-colors"
                >
                  View CAD & Book
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
