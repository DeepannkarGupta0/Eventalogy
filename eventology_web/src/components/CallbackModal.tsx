"use client";

import { useState } from "react";
import { X, Phone, MessageCircle, Calendar, Users, MapPin, CheckCircle2, Sparkles } from "lucide-react";

interface CallbackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CallbackModal({ isOpen, onClose }: CallbackModalProps) {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    city: "Raipur",
    eventType: "Royal Wedding",
    guestCount: "500 - 1,000",
    date: "",
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleReset = () => {
    setSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity">
      <div className="relative w-full max-w-lg rounded-3xl border border-[#FFD700]/30 bg-[#141416] p-6 sm:p-8 shadow-[0_20px_70px_rgba(255,215,0,0.15)] text-white">
        {/* Close Button */}
        <button
          onClick={handleReset}
          className="absolute right-5 top-5 rounded-full p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#FFD700]/10 px-3 py-1 text-xs font-bold text-[#FFD700] border border-[#FFD700]/20 uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Event Concierge</span>
              </div>
              <h3 className="text-2xl font-bold font-outfit text-white mt-2">
                Request a Callback
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Share your celebration vision. Our senior event director will call you within 15 minutes with verified venue options and budget guidance.
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Your Full Name</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Ananya Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#1F1F22] px-4 py-3 text-white placeholder-slate-500 focus:border-[#FFD700] focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Phone Number (with WhatsApp)</label>
                <input
                  required
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-[#1F1F22] px-4 py-3 text-white placeholder-slate-500 focus:border-[#FFD700] focus:outline-none transition-colors font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Event Type</label>
                  <select
                    value={formData.eventType}
                    onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#1F1F22] px-3 py-3 text-white focus:border-[#FFD700] focus:outline-none transition-colors"
                  >
                    <option value="Royal Wedding">Royal Wedding</option>
                    <option value="Stadium Concert">Stadium Concert</option>
                    <option value="Corporate Gala">Corporate Gala</option>
                    <option value="Destination Celebration">Destination Celebration</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Target City</label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#1F1F22] px-3 py-3 text-white focus:border-[#FFD700] focus:outline-none transition-colors"
                  >
                    <option value="Raipur">Raipur</option>
                    <option value="Jaipur">Jaipur</option>
                    <option value="Goa">Goa</option>
                    <option value="Delhi NCR">Delhi NCR</option>
                    <option value="Mumbai">Mumbai</option>
                    <option value="Udaipur">Udaipur</option>
                    <option value="Other">Other City</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Estimated Guests</label>
                  <select
                    value={formData.guestCount}
                    onChange={(e) => setFormData({ ...formData, guestCount: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#1F1F22] px-3 py-3 text-white focus:border-[#FFD700] focus:outline-none transition-colors"
                  >
                    <option value="100 - 300">100 - 300 Guests</option>
                    <option value="300 - 600">300 - 600 Guests</option>
                    <option value="600 - 1,200">600 - 1,200 Guests</option>
                    <option value="1,200+">1,200+ Guests</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Target Month / Date</label>
                  <input
                    type="text"
                    placeholder="e.g. Dec 2026 or Nov 25"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#1F1F22] px-3 py-3 text-white placeholder-slate-500 focus:border-[#FFD700] focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#FFD700] to-[#FFF0A8] py-3.5 text-xs font-bold uppercase tracking-wider text-black shadow-lg hover:brightness-110 active:scale-95 transition-all"
              >
                Request Free Callback
              </button>

              <div className="text-center">
                <span className="text-[11px] text-slate-400">Prefer instant messaging? </span>
                <a
                  href="https://wa.me/917714009000?text=Hi%20Eventalogy!%20I%20would%20like%20to%20plan%20an%20event."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-emerald-400 hover:underline inline-flex items-center gap-1"
                >
                  <MessageCircle className="h-3 w-3" />
                  <span>Chat on WhatsApp directly</span>
                </a>
              </div>
            </div>
          </form>
        ) : (
          <div className="text-center py-8 space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-bold font-outfit text-white">Callback Scheduled!</h3>
              <p className="text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
                Thank you, <span className="text-[#FFD700] font-semibold">{formData.name}</span>! Our senior event director has received your request for {formData.eventType} in {formData.city} and will connect with you shortly on {formData.phone}.
              </p>
            </div>

            <div className="pt-4 flex flex-col gap-2">
              <a
                href={`https://wa.me/917714009000?text=Hi%20Eventalogy!%20My%20name%20is%20${encodeURIComponent(
                  formData.name
                )}%20and%20I%20just%20requested%20a%20callback%20for%20a%20${encodeURIComponent(
                  formData.eventType
                )}%20in%20${encodeURIComponent(formData.city)}.`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 py-3 text-xs font-bold uppercase tracking-wider text-black shadow-lg transition-all"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Continue on WhatsApp Now</span>
              </a>

              <button
                onClick={handleReset}
                className="text-xs text-slate-400 hover:text-white py-2"
              >
                Close Window
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
