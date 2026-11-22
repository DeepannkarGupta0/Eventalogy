'use client'

import React from 'react'
import { Sparkles, MessageCircle, PhoneCall, ArrowUpRight } from 'lucide-react'

interface GatewayDockProps {
  progress: number // Phase 6 progress (0 to 1)
  onOpenCallback: () => void
}

export function GatewayDock({ progress, onOpenCallback }: GatewayDockProps) {
  const visible = progress > 0.05
  const opacity = Math.min(1, progress * 1.8)

  // Staggered slide up
  const card1Y = (1 - Math.min(1, progress * 1.5)) * 60
  const card2Y = (1 - Math.min(1, Math.max(0, progress - 0.15) * 1.5)) * 60
  const card3Y = (1 - Math.min(1, Math.max(0, progress - 0.3) * 1.5)) * 60

  if (!visible) return null

  return (
    <div
      className="relative z-30 pt-12 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto transition-opacity duration-300"
      style={{ opacity }}
    >
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-800 text-xs font-medium tracking-wider uppercase mb-3">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          Choose Your Gateway
        </div>
        <h3 className="text-2xl sm:text-4xl font-semibold text-zinc-900 tracking-tight">
          How would you like to plan your event?
        </h3>
        <p className="mt-2 text-sm sm:text-base text-zinc-600">
          Connect instantly via our real-time Web Studio, chat on WhatsApp, or speak
          with an Eventalogy Private Concierge.
        </p>
      </div>

      {/* 3 Gateway Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Web App Studio */}
        <div
          className="group relative bg-white rounded-2xl p-7 border-2 border-amber-500/30 hover:border-amber-500 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
          style={{ transform: `translate3d(0, ${card1Y}px, 0)` }}
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="inline-block text-[11px] font-semibold tracking-wider uppercase text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md mb-2">
              Instant Self-Service
            </div>
            <h4 className="text-xl font-semibold text-zinc-900 mb-2">
              Web App Studio
            </h4>
            <p className="text-sm text-zinc-600 leading-relaxed mb-6">
              Customize dates, guest counts, venue setups, catering palettes, and
              instant AI cost breakdowns.
            </p>
          </div>

          <a
            href="https://eventology-website.vercel.app/studio"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm transition-colors shadow-sm"
          >
            Launch Web Studio
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>

        {/* Card 2: WhatsApp Bot */}
        <div
          className="group relative bg-white rounded-2xl p-7 border-2 border-emerald-500/30 hover:border-emerald-500 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
          style={{ transform: `translate3d(0, ${card2Y}px, 0)` }}
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div className="inline-block text-[11px] font-semibold tracking-wider uppercase text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md mb-2">
              Real-Time Chat
            </div>
            <h4 className="text-xl font-semibold text-zinc-900 mb-2">
              WhatsApp Concierge
            </h4>
            <p className="text-sm text-zinc-600 leading-relaxed mb-6">
              Chat directly with our automated booking assistant. Get brochures,
              quotes, and live availability in seconds.
            </p>
          </div>

          <a
            href="https://wa.me/919999999999?text=Hello%20Eventalogy%2C%20I%20would%20like%20to%20plan%20an%20event"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors shadow-sm"
          >
            Chat on WhatsApp
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>

        {/* Card 3: Request Callback */}
        <div
          className="group relative bg-white rounded-2xl p-7 border-2 border-zinc-200 hover:border-zinc-400 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
          style={{ transform: `translate3d(0, ${card3Y}px, 0)` }}
        >
          <div>
            <div className="w-12 h-12 rounded-xl bg-zinc-100 text-zinc-800 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
              <PhoneCall className="w-6 h-6" />
            </div>
            <div className="inline-block text-[11px] font-semibold tracking-wider uppercase text-zinc-700 bg-zinc-100 px-2.5 py-0.5 rounded-md mb-2">
              White-Glove Support
            </div>
            <h4 className="text-xl font-semibold text-zinc-900 mb-2">
              Request Callback
            </h4>
            <p className="text-sm text-zinc-600 leading-relaxed mb-6">
              Speak directly with an Eventalogy Senior Planner for bespoke
              arrangements, NDA projects, and VIP bookings.
            </p>
          </div>

          <button
            onClick={onOpenCallback}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-zinc-900 hover:bg-black text-white font-medium text-sm transition-colors shadow-sm"
          >
            Schedule a Call
            <PhoneCall className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
