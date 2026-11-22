'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Sparkles,
  MessageCircle,
  PhoneCall,
  Laptop,
  ArrowUpRight,
  ChevronDown,
} from 'lucide-react'

interface StorytellingScrollInnerProps {
  onOpenCallback: () => void
}

export default function StorytellingScrollInner({
  onOpenCallback,
}: StorytellingScrollInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [mouseTilt, setMouseTilt] = useState({ x: 0, y: 0 })
  const targetTilt = useRef({ x: 0, y: 0 })

  // Track scroll progress across the container
  useEffect(() => {
    let rafId: number
    const handleScroll = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        if (!containerRef.current) return
        const rect = containerRef.current.getBoundingClientRect()
        const totalScroll = containerRef.current.offsetHeight - window.innerHeight
        if (totalScroll <= 0) return
        const scrolled = -rect.top
        const p = Math.max(0, Math.min(1, scrolled / totalScroll))
        setScrollProgress(p)
      })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => {
      window.removeEventListener('scroll', handleScroll)
      cancelAnimationFrame(rafId)
    }
  }, [])

  // Mouse tilt for interactive card parallax
  useEffect(() => {
    let animId: number
    const handleMouseMove = (e: MouseEvent) => {
      targetTilt.current = {
        x: (e.clientX / window.innerWidth - 0.5) * 18,
        y: (e.clientY / window.innerHeight - 0.5) * -18,
      }
    }

    const updateTilt = () => {
      setMouseTilt((prev) => ({
        x: prev.x + (targetTilt.current.x - prev.x) * 0.08,
        y: prev.y + (targetTilt.current.y - prev.y) * 0.08,
      }))
      animId = requestAnimationFrame(updateTilt)
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    animId = requestAnimationFrame(updateTilt)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(animId)
    }
  }, [])

  // Golden particle canvas background
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId: number
    let width = (canvas.width = window.innerWidth)
    let height = (canvas.height = window.innerHeight)

    const handleResize = () => {
      width = canvas.width = window.innerWidth
      height = canvas.height = window.innerHeight
    }
    window.addEventListener('resize', handleResize)

    // Particle count
    const count = window.innerWidth < 768 ? 50 : 110
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.5 + 0.8,
      speedY: Math.random() * 0.4 + 0.15,
      speedX: (Math.random() - 0.5) * 0.25,
      opacity: Math.random() * 0.6 + 0.2,
      pulse: Math.random() * Math.PI * 2,
    }))

    const renderParticles = () => {
      ctx.clearRect(0, 0, width, height)

      // Ambient radial glow in center
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        50,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.7
      )
      gradient.addColorStop(0, 'rgba(212, 175, 55, 0.08)')
      gradient.addColorStop(0.5, 'rgba(180, 130, 40, 0.03)')
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)

      // Draw floating golden particles
      particles.forEach((p) => {
        p.y -= p.speedY
        p.x += p.speedX
        p.pulse += 0.02
        if (p.y < -10) p.y = height + 10
        if (p.x < -10) p.x = width + 10
        if (p.x > width + 10) p.x = -10

        const alpha = p.opacity * (0.6 + Math.sin(p.pulse) * 0.4)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 225, 140, ${alpha})`
        ctx.shadowColor = 'rgba(212, 175, 55, 0.6)'
        ctx.shadowBlur = p.size * 3
        ctx.fill()
      })

      animId = requestAnimationFrame(renderParticles)
    }

    renderParticles()
    return () => {
      window.removeEventListener('resize', handleResize)
      cancelAnimationFrame(animId)
    }
  }, [])

  // ── PHASE CALCULATIONS ───────────────────────────────────────────────────
  // Phase 1 (0 to 0.06): Ambient Card Idle
  // Phase 2 (0.06 to 0.28): Card Snaps Flat & Book Hinge Opens (0 to -165 deg)
  // Phase 3 (0.28 to 0.55): Camera Dives In & Zooms into the Grand Gateway
  // Phase 4 (0.55 to 0.72): Gates physically swing wide open & god-rays spill
  // Phase 5 (0.72 to 0.88): Living Celebration Hall in full glory
  // Phase 6 (0.88 to 1.00): Scene blends to ivory & 3 Gateway cards slide in

  const pOpen = Math.max(0, Math.min(1, (scrollProgress - 0.04) / 0.22))
  const pZoom = Math.max(0, Math.min(1, (scrollProgress - 0.26) / 0.26))
  const pGate = Math.max(0, Math.min(1, (scrollProgress - 0.52) / 0.18))
  const pCeleb = Math.max(0, Math.min(1, (scrollProgress - 0.68) / 0.18))
  const pDock = Math.max(0, Math.min(1, (scrollProgress - 0.86) / 0.14))

  // Book hinge angle: 0deg closed -> -165deg fully open
  const bookHingeDeg = -pOpen * 165

  // Camera zoom factor: 1x -> 6x
  const zoomScale = 1 + pZoom * 5.2

  // Gate swing: 0deg closed -> 85deg open
  const doorOpenDeg = pGate * 85

  // Idle tilt & bob
  const isIdle = scrollProgress < 0.05
  const idleTiltX = isIdle ? mouseTilt.y : mouseTilt.y * (1 - pOpen)
  const idleTiltY = isIdle ? mouseTilt.x : mouseTilt.x * (1 - pOpen)

  return (
    <div
      ref={containerRef}
      id="storytelling-container"
      className="relative w-full"
      style={{ height: '400vh' }}
    >
      {/* ── STICKY VIEWPORT (100dvh pinned) ─────────────────────────────────── */}
      <div
        id="storytelling-sticky"
        className="sticky top-0 w-full h-[100dvh] overflow-hidden bg-gradient-to-b from-[#0C0804] via-[#1A1107] to-[#0A0602] select-none"
      >
        {/* Ambient Particle Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-0 pointer-events-none"
          style={{ opacity: 1 - pDock }}
        />

        {/* ── SLEEK FLOATING BRAND HEADER (Integrated at the very top) ────────── */}
        <header
          className="absolute top-0 inset-x-0 z-50 px-6 sm:px-10 py-5 flex items-center justify-between border-b border-amber-500/10 backdrop-blur-md bg-black/20 transition-opacity duration-300"
          style={{ opacity: 1 - pDock }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] shadow-[0_0_20px_rgba(212,175,55,0.4)] text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-outfit text-lg sm:text-xl font-black tracking-widest text-white">
                  EVENTALOGY
                </span>
                <span className="font-outfit text-[10px] font-extrabold tracking-widest text-[#D4AF37] uppercase">
                  INTERNATIONAL
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-amber-200/60 font-light tracking-wide">
                Royal Weddings &bull; Stadium Concerts &bull; Luxury Galas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://wa.me/917714009000?text=Hi%20Eventalogy!%20I%20would%20like%20to%20plan%20an%20event."
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/60 backdrop-blur-md px-3.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-900/60 transition-colors shadow-sm"
            >
              <MessageCircle className="h-3.5 w-3.5 text-emerald-400" />
              <span>WhatsApp 24/7</span>
            </a>

            <button
              onClick={onOpenCallback}
              className="flex items-center gap-1.5 rounded-full border border-[#D4AF37]/50 bg-[#FFF8E7]/10 backdrop-blur-md px-3.5 py-1.5 text-xs font-bold text-[#E5C07B] hover:bg-[#D4AF37]/20 transition-colors shadow-sm"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              <span>Request Callback</span>
            </button>
          </div>
        </header>

        {/* ── 3D SCENE STAGE (Card & Zoom Container) ─────────────────────────── */}
        <div
          className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
          style={{
            perspective: '1400px',
            opacity: Math.max(0, 1 - pCeleb * 1.8),
            transform: `scale(${zoomScale})`,
            transformOrigin: '75% 50%',
            transition: 'opacity 0.2s ease',
          }}
        >
          {/* Card Rig Wrapper with 3D Tilt */}
          <div
            className="relative flex items-center justify-center transition-transform duration-75 ease-out"
            style={{
              transformStyle: 'preserve-3d',
              transform: `rotateX(${idleTiltX}deg) rotateY(${idleTiltY}deg)`,
            }}
          >
            {/* ── THE 2-FOLD LUXURY INVITATION CARD ──────────────────────────── */}
            <div
              className="relative flex items-center shadow-2xl rounded-2xl"
              style={{
                width: 'min(720px, 92vw)',
                height: 'min(500px, 68vh)',
                transformStyle: 'preserve-3d',
                boxShadow:
                  '0 30px 80px -20px rgba(0,0,0,0.9), 0 0 50px rgba(212,175,55,0.2)',
              }}
            >
              {/* LEFT PAGE (Stationary Base Spread) */}
              <div
                className="w-1/2 h-full rounded-l-2xl p-6 sm:p-10 flex flex-col justify-between border-y-2 border-l-2 border-r border-[#C59B27]/40 relative overflow-hidden"
                style={{
                  background:
                    'linear-gradient(135deg, #FBF8F1 0%, #F5EFE0 50%, #EDE4D0 100%)',
                }}
              >
                {/* Gold filigree decorative border */}
                <div className="absolute inset-3 rounded-lg border border-[#C59B27]/30 pointer-events-none" />

                <div className="relative z-10 text-center space-y-3">
                  <span className="text-[11px] sm:text-xs font-serif tracking-[0.25em] text-[#B8860B] uppercase">
                    ✦ Together with Honour ✦
                  </span>
                  <h3 className="font-serif text-xl sm:text-3xl font-semibold text-[#1F170E] leading-tight">
                    You Are Cordially Invited
                  </h3>
                  <div className="text-[#C59B27] text-xs">❖ &bull; ❖ &bull; ❖</div>
                  <p className="font-outfit text-xs sm:text-sm text-[#4E3D2A] leading-relaxed max-w-xs mx-auto">
                    To enter a sanctuary where bespoke celebrations transcend into
                    timeless legends.
                  </p>
                </div>

                <div className="relative z-10 text-center space-y-2 border-t border-[#C59B27]/20 pt-4">
                  <p className="text-[10px] sm:text-xs font-semibold tracking-widest text-[#9C782F] uppercase">
                    Weddings &bull; Galas &bull; Concerts &bull; Summits
                  </p>
                  <p className="text-[10px] text-[#7A6348] italic font-serif">
                    Eventalogy International Directorate
                  </p>
                </div>
              </div>

              {/* RIGHT PAGE / GATEWAY PORTAL (Revealed when open) */}
              <div
                className="w-1/2 h-full rounded-r-2xl p-4 sm:p-6 flex flex-col items-center justify-center border-y-2 border-r-2 border-l border-[#C59B27]/40 relative overflow-hidden"
                style={{
                  background:
                    'linear-gradient(135deg, #1C1208 0%, #2E1D0D 50%, #150D05 100%)',
                }}
              >
                {/* ── THE GRAND PALACE GATEWAY (Inside Right Page) ───────────── */}
                <div className="relative w-full h-full flex flex-col items-center justify-between py-2">
                  {/* Glowing Palace Lanterns */}
                  <div className="w-full flex items-center justify-between px-4">
                    <div className="w-6 h-6 rounded-full bg-amber-400 shadow-[0_0_20px_6px_rgba(255,200,80,0.9)] animate-pulse" />
                    <span className="text-[10px] sm:text-xs tracking-[0.2em] font-serif text-amber-200/90 uppercase font-bold">
                      The Grand Portal
                    </span>
                    <div className="w-6 h-6 rounded-full bg-amber-400 shadow-[0_0_20px_6px_rgba(255,200,80,0.9)] animate-pulse" />
                  </div>

                  {/* Grand Arch Frame with 3D Swinging Doors */}
                  <div
                    className="relative w-4/5 h-3/4 rounded-t-full border-4 border-[#D4AF37] shadow-[0_0_40px_rgba(212,175,55,0.4)] flex overflow-hidden"
                    style={{
                      perspective: '800px',
                      background:
                        'radial-gradient(circle at 50% 50%, #4A3319 0%, #170E06 100%)',
                    }}
                  >
                    {/* Marigold Toran Garland across arch */}
                    <div className="absolute top-0 inset-x-0 h-6 border-b-2 border-dashed border-amber-300 flex items-center justify-around z-20">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className="w-3 h-3 rounded-full bg-amber-500 shadow-md"
                        />
                      ))}
                    </div>

                    {/* Left Gate Door (Swings outward) */}
                    <div
                      className="w-1/2 h-full bg-gradient-to-r from-[#2B1B0E] via-[#3D2714] to-[#201409] border-r border-[#D4AF37]/50 flex items-center justify-center transition-transform origin-left z-10"
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: `rotateY(${-doorOpenDeg}deg)`,
                      }}
                    >
                      <div className="w-8 h-8 rounded-full border-2 border-[#D4AF37] flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                      </div>
                    </div>

                    {/* Right Gate Door (Swings outward) */}
                    <div
                      className="w-1/2 h-full bg-gradient-to-l from-[#2B1B0E] via-[#3D2714] to-[#201409] border-l border-[#D4AF37]/50 flex items-center justify-center transition-transform origin-right z-10"
                      style={{
                        transformStyle: 'preserve-3d',
                        transform: `rotateY(${doorOpenDeg}deg)`,
                      }}
                    >
                      <div className="w-8 h-8 rounded-full border-2 border-[#D4AF37] flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-[#D4AF37]" />
                      </div>
                    </div>

                    {/* Behind the doors: Radiant Celebration Light Burst */}
                    <div
                      className="absolute inset-0 flex flex-col items-center justify-center text-center p-4 z-0 transition-opacity duration-300"
                      style={{ opacity: Math.min(1, pGate * 2) }}
                    >
                      <div className="w-24 h-24 rounded-full bg-amber-300 blur-xl opacity-80 animate-pulse" />
                      <span className="text-white font-serif text-sm font-bold tracking-wider relative z-10 drop-shadow-md">
                        Step Inside
                      </span>
                    </div>
                  </div>

                  {/* Scroll cue */}
                  <div className="text-center">
                    <span className="text-[10px] text-amber-300/80 tracking-widest uppercase">
                      Scroll to enter &darr;
                    </span>
                  </div>
                </div>
              </div>

              {/* ── THE 3D HINGED COVER (Front Cover that swings open) ─────────── */}
              <div
                className="absolute top-0 right-0 w-1/2 h-full rounded-r-2xl p-6 sm:p-10 flex flex-col justify-between border-2 border-[#C59B27] shadow-2xl transition-transform ease-out z-30"
                style={{
                  transformOrigin: 'left center',
                  transformStyle: 'preserve-3d',
                  transform: `rotateY(${bookHingeDeg}deg)`,
                  background:
                    'linear-gradient(135deg, #FAF6EE 0%, #F5EFE0 50%, #EDE4D1 100%)',
                  backfaceVisibility: 'hidden',
                }}
              >
                {/* Double Gold Filigree Border */}
                <div className="absolute inset-3 rounded-xl border-2 border-[#D4AF37] pointer-events-none" />
                <div className="absolute inset-5 rounded-lg border border-[#D4AF37]/40 pointer-events-none" />

                {/* Top Corner Ornaments */}
                <div className="relative z-10 flex justify-between text-[#C59B27] text-sm font-serif">
                  <span>❖</span>
                  <span>❖</span>
                </div>

                {/* Center Monogram Crest */}
                <div className="relative z-10 text-center space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-full border-2 border-[#D4AF37] flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.3)] bg-gradient-to-b from-[#FFFDF9] to-[#F5EFE0]">
                    <span className="font-serif text-4xl font-bold text-[#B8860B]">
                      E
                    </span>
                  </div>

                  <div>
                    <h2 className="font-outfit text-2xl sm:text-3xl font-black tracking-[0.18em] text-[#1A140B]">
                      EVENTALOGY
                    </h2>
                    <p className="text-[10px] sm:text-xs font-extrabold tracking-[0.3em] text-[#C59B27] uppercase mt-1">
                      INTERNATIONAL
                    </p>
                  </div>

                  <div className="text-[#C59B27] text-xs">✦ &bull; ✦ &bull; ✦</div>
                  <p className="text-[11px] sm:text-xs font-medium tracking-[0.2em] text-[#6B5435] uppercase">
                    An Invitation to Splendor
                  </p>
                </div>

                {/* Bottom Fleurons */}
                <div className="relative z-10 flex justify-between text-[#C59B27] text-sm font-serif">
                  <span>❖</span>
                  <span>❖</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── PHASE 5: THE LIVING CELEBRATION HALL (Emerges through gates) ─────── */}
        <div
          className="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center text-center px-6 transition-opacity duration-500 overflow-hidden"
          style={{
            opacity: Math.max(0, Math.min(1, pCeleb * 1.5 - pDock * 1.5)),
            background:
              'radial-gradient(circle at 50% 40%, rgba(55, 35, 15, 0.92) 0%, rgba(20, 12, 5, 0.98) 75%, #0A0602 100%)',
          }}
        >
          {/* Sweeping Concert Spotlight Beams */}
          <div
            className="absolute -top-32 left-1/4 w-40 h-[900px] opacity-35 transform -rotate-12 blur-3xl pointer-events-none"
            style={{
              background:
                'linear-gradient(180deg, rgba(255, 235, 160, 0.8) 0%, rgba(212, 175, 55, 0.2) 60%, transparent 100%)',
            }}
          />
          <div
            className="absolute -top-32 right-1/4 w-40 h-[900px] opacity-35 transform rotate-12 blur-3xl pointer-events-none"
            style={{
              background:
                'linear-gradient(180deg, rgba(255, 235, 160, 0.8) 0%, rgba(212, 175, 55, 0.2) 60%, transparent 100%)',
            }}
          />

          {/* Celebration Hall Content */}
          <div className="relative z-10 max-w-4xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 text-xs sm:text-sm font-medium tracking-widest uppercase shadow-lg backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>You Have Arrived At The Celebration</span>
            </div>

            <h1 className="font-outfit text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-[1.08] drop-shadow-2xl">
              Curating <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400">Extraordinary</span> Celebrations Worldwide.
            </h1>

            <p className="text-base sm:text-lg text-amber-100/90 leading-relaxed font-light max-w-2xl mx-auto drop-shadow-md">
              From heritage palaces in Rajasthan and coastal lawns in Goa, to mega concerts and corporate summits —{' '}
              <strong className="text-amber-300 font-semibold">Eventalogy International</strong> is your complete production partner.
            </p>

            {/* Event Category Badges */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {[
                'Royal Palaces & Forts',
                'Beachfront Resorts',
                'Stadium Concerts',
                'Global Summits',
                'Private Luxury Villas',
              ].map((cat) => (
                <span
                  key={cat}
                  className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-white/10 backdrop-blur-md border border-amber-300/30 text-amber-100 shadow-md"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── PHASE 1 INITIAL SCROLL CUE ──────────────────────────────────────── */}
        {scrollProgress < 0.05 && (
          <div className="absolute bottom-8 inset-x-0 z-40 flex flex-col items-center justify-center pointer-events-none animate-bounce">
            <span className="text-amber-200/80 text-xs font-outfit uppercase tracking-[0.25em] mb-1.5 font-medium">
              Scroll to Open Invitation
            </span>
            <ChevronDown className="w-5 h-5 text-amber-300" />
          </div>
        )}

        {/* ── PHASE 6: SMOOTH BACKGROUND TRANSITION TO WARM IVORY ──────────────── */}
        <div
          className="absolute inset-0 z-30 pointer-events-none transition-opacity duration-300 bg-[#FAF8F5]"
          style={{ opacity: pDock }}
        />
      </div>

      {/* ── PHASE 6 DOCKING: THE 3 GATEWAY HUBS (SLIDES UP SMOOTHLY) ─────────── */}
      <div
        className="relative z-40 -mt-[100dvh] min-h-[100dvh] flex flex-col justify-end pb-16 px-6 lg:px-8 max-w-7xl mx-auto"
        style={{
          opacity: Math.min(1, pDock * 2),
          transform: `translate3d(0, ${(1 - pDock) * 80}px, 0)`,
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        <div className="text-center max-w-3xl mx-auto mb-10 pt-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[#B8860B] text-xs font-bold tracking-wider uppercase mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Choose Your Gateway</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-[#18181B] tracking-tight">
            How would you like to plan your event?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-600">
            Open our interactive Web App Studio, chat 24/7 with our WhatsApp bot, or speak with an Eventalogy Senior Director.
          </p>
        </div>

        {/* The 3 Gateway Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {/* Gateway 1: Web App Studio */}
          <div className="rounded-3xl border border-[#D4AF37]/35 bg-white p-7 shadow-[0_8px_30px_rgba(184,134,11,0.08)] hover:shadow-[0_12px_40px_rgba(184,134,11,0.18)] hover:border-[#B8860B] transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF8E7] border border-[#FDE68A] text-[#B8860B] shadow-sm group-hover:scale-105 transition-transform">
                  <Laptop className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  INSTANT IN-BROWSER
                </span>
              </div>
              <h3 className="font-outfit text-2xl font-bold text-[#18181B] group-hover:text-[#B8860B] transition-colors">
                Web App Studio
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Open our interactive workspace. Explore 450+ verified venues, design seating layouts, receive live
                itemized vendor bids, and manage milestone payments.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100">
              <a
                href="/app"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#B8860B] via-[#D4AF37] to-[#C59B27] py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md hover:brightness-105 active:scale-95 transition-all"
              >
                <span>Launch Web App</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Gateway 2: WhatsApp Bot & Concierge */}
          <div className="rounded-3xl border border-emerald-200 bg-white p-7 shadow-[0_8px_30px_rgba(5,150,105,0.08)] hover:shadow-[0_12px_40px_rgba(5,150,105,0.18)] hover:border-emerald-400 transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 shadow-sm group-hover:scale-105 transition-transform">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  24/7 AUTOMATED BOT
                </span>
              </div>
              <h3 className="font-outfit text-2xl font-bold text-[#18181B] group-hover:text-emerald-700 transition-colors">
                WhatsApp Concierge
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Chat directly with our automated assistant. Get instant budget estimates, check venue date
                availabilities, and connect directly with senior event directors.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100">
              <a
                href="https://wa.me/917714009000?text=Hi%20Eventalogy!%20I%20would%20like%20to%20plan%20an%20event."
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md active:scale-95 transition-all"
              >
                <span>Chat on WhatsApp</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Gateway 3: Request Callback */}
          <div className="rounded-3xl border border-[#D4AF37]/35 bg-white p-7 shadow-[0_8px_30px_rgba(184,134,11,0.08)] hover:shadow-[0_12px_40px_rgba(184,134,11,0.18)] hover:border-[#B8860B] transition-all flex flex-col justify-between group">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF8E7] border border-[#FDE68A] text-[#B8860B] shadow-sm group-hover:scale-105 transition-transform">
                  <PhoneCall className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-[#FFF8E7] px-3 py-1 text-[11px] font-bold text-[#B8860B] border border-[#FDE68A]">
                  WHITE-GLOVE SUPPORT
                </span>
              </div>
              <h3 className="font-outfit text-2xl font-bold text-[#18181B] group-hover:text-[#B8860B] transition-colors">
                Private Concierge
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Schedule a direct consultation with an Eventalogy Senior Director for high-profile weddings,
                stadium concerts, VIP security, and NDA protocols.
              </p>
            </div>

            <div className="pt-6 mt-6 border-t border-slate-100">
              <button
                onClick={onOpenCallback}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#18181B] hover:bg-black py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-md active:scale-95 transition-all"
              >
                <span>Request Callback</span>
                <PhoneCall className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
