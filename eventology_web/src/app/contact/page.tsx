"use client";


import { useState } from "react";
import Link from "next/link";
import { Mail, Phone, MapPin, Send, CheckCircle2, Building2, ArrowLeft } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    eventType: "Luxury Wedding",
    city: "Raipur",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="py-12 md:py-20 px-6 lg:px-8 space-y-12 max-w-5xl mx-auto">
      <div>
        <Link href="/" className="inline-flex items-center gap-2 text-xs font-bold text-[#FFD700] hover:underline mb-4">
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Eventology Home</span>
        </Link>
        <div className="flex items-center gap-2 text-xs font-bold text-[#FFD700] uppercase tracking-wider">
          <Building2 className="h-4 w-4" />
          <span>Corporate & Dispatch Headquarters</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mt-2">
          Contact & Enterprise Dispatch
        </h1>
        <p className="mt-3 text-sm sm:text-base text-slate-400 max-w-2xl">
          Speak with our technical event architects, register your venue inventory, or request an institutional RFP proposal.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 border-t border-white/10 pt-10">
        {/* Contact Info */}
        <div className="lg:col-span-5 space-y-8">
          <div className="rounded-2xl border border-white/10 bg-[#10131E] p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Central Operations Center</h3>
            <div className="space-y-4 text-xs text-slate-300">
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-[#FFD700] shrink-0 mt-0.5" />
                <span>
                  VIP Estate, Shankar Nagar, Raipur, Chhattisgarh 492007, India
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-[#10B981] shrink-0" />
                <span className="font-mono text-sm">+91 771 400 9000</span>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-[#3B82F6] shrink-0" />
                <span className="font-mono">dispatch@eventology.in</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#10131E] p-6 space-y-2">
            <h4 className="text-sm font-bold text-white">24/7 Field Logistics Hotline</h4>
            <p className="text-xs text-slate-400">
              Active production teams, truck loading dock dispatchers, and stage sound engineers can reach technical arbitration 24/7.
            </p>
          </div>

          <div className="rounded-2xl border border-[#FFD700]/30 bg-[#FFD700]/5 p-6 space-y-2">
            <h4 className="text-sm font-bold text-[#FFD700]">Direct Web App Access</h4>
            <p className="text-xs text-slate-300">
              Looking to design a CAD seating layout or calculate egress right away? Launch the live studio.
            </p>
            <div className="pt-2">
              <Link
                href="/app"
                className="inline-block rounded-lg bg-[#FFD700] px-4 py-2 text-xs font-bold text-black hover:brightness-110 transition-all"
              >
                Open Web Studio →
              </Link>
            </div>
          </div>
        </div>

        {/* Contact Form */}
        <div className="lg:col-span-7">
          <div className="rounded-3xl border border-white/10 bg-[#121624] p-8 shadow-2xl">
            {submitted ? (
              <div className="text-center py-12 space-y-4">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold text-white">Request Received</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  An Eventology production director has received your specification and will contact you within 2 operational hours.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="rounded-lg bg-white/10 px-5 py-2 text-xs font-bold text-white hover:bg-white/15"
                >
                  Send another inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <h3 className="text-xl font-bold text-white">Submit an Event Specification</h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Your Name / Organization
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Singhania"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FFD700]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="vikram@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FFD700]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                      Phone (WhatsApp)
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FFD700]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                      Event Format
                    </label>
                    <select
                      value={formData.eventType}
                      onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-[#0E121E] px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#FFD700]"
                    >
                      <option value="Luxury Wedding">Luxury Wedding</option>
                      <option value="Stadium Concert">Stadium Concert</option>
                      <option value="Corporate Summit">Corporate Summit</option>
                      <option value="Exhibition / Expo">Exhibition / Expo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Raipur, Bilaspur, Delhi"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FFD700]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                    Production Scope & Guest Count
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Describe expected attendance, stage dimensions, sound/lighting requirements, and dates..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#FFD700]"
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-[#FFD700] to-[#E6B800] py-3.5 text-xs font-bold text-black shadow-lg hover:brightness-110 transition-all"
                >
                  <Send className="h-4 w-4" />
                  <span>Submit Specification</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
