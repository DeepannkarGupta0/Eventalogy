'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Sparkles,
  MessageCircle,
  PhoneCall,
  Laptop,
  ArrowUpRight,
  ChevronDown,
  ShieldCheck,
  Globe2,
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
        x: (e.clientX / window.innerWidth - 0.5) * 16,
        y: (e.clientY / window.innerHeight - 0.5) * -16,
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

    const count = window.innerWidth < 768 ? 40 : 85
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.2 + 0.8,
      speedY: Math.random() * 0.35 + 0.15,
      speedX: (Math.random() - 0.5) * 0.25,
      opacity: Math.random() * 0.5 + 0.2,
      pulse: Math.random() * Math.PI * 2,
    }))

    const renderParticles = () => {
      ctx.clearRect(0, 0, width, height)

      // Ambient radial glow in center
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        40,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.7
      )
      gradient.addColorStop(0, 'rgba(212, 175, 55, 0.09)')
      gradient.addColorStop(0.5, 'rgba(160, 110, 30, 0.03)')
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
        ctx.fillStyle = `rgba(255, 230, 150, ${alpha})`
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

  // ── PRECISE SCROLL PHASES ────────────────────────────────────────────────
  // Phase 1 (0.00 to 0.20): VIP Card opens like an exclusive pass (0 to 180deg).
  // Phase 2 (0.20 to 0.40): Camera dives into the card; dreamy golden mist rolls in.
  //   - Card dissolves completely behind mist (card is GONE).
  // Phase 3 (0.40 to 0.65): Golden clouds part; majestic Grand Gateway appears.
  //   - Imposing palace gates physically swing open wide (0 to 85deg).
  //   - Radiant stage light & golden sparkles burst forth.
  // Phase 4 (0.65 to 0.85): Through the gate into the live celebration hall.
  //   - An actual grand celebration / concert / gala being conducted.
  // Phase 5 (0.85 to 1.00): Seamlessly lands into warm ivory background & 3 Gateway cards dock.

  const pOpen = Math.max(0, Math.min(1, scrollProgress / 0.20))
  const pClouds = Math.max(0, Math.min(1, (scrollProgress - 0.20) / 0.18))
  const pGateEnter = Math.max(0, Math.min(1, (scrollProgress - 0.38) / 0.14))
  const pGateDoors = Math.max(0, Math.min(1, (scrollProgress - 0.48) / 0.18))
  const pCeleb = Math.max(0, Math.min(1, (scrollProgress - 0.66) / 0.18))
  const pDock = Math.max(0, Math.min(1, (scrollProgress - 0.84) / 0.16))

  // Book hinge: 0deg closed -> -180deg open
  const bookHingeDeg = -pOpen * 180

  // As the front cover opens to the left, shift the card assembly so the 2-page spread stays centered
  const cardShiftX = pOpen * 180

  // Zoom during cloud transition
  const cardZoom = 1 + pClouds * 2.5
  // Card fades out completely behind clouds
  const cardOpacity = Math.max(0, 1 - pClouds * 1.5)

  // Cloud density: peaks around p = 0.38 - 0.45
  let cloudOpacity = 0
  if (scrollProgress >= 0.18 && scrollProgress < 0.40) {
    cloudOpacity = (scrollProgress - 0.18) / 0.14
  } else if (scrollProgress >= 0.40 && scrollProgress < 0.58) {
    cloudOpacity = 1 - (scrollProgress - 0.40) / 0.18
  }
  cloudOpacity = Math.max(0, Math.min(1, cloudOpacity))

  // Gate presence & scale
  const gateOpacity = Math.max(0, Math.min(1, pGateEnter * 2 - pCeleb * 1.5))
  const gateScale = 0.85 + pGateDoors * 0.45
  const gateDoorsOpenDeg = pGateDoors * 85

  // Idle tilt
  const isIdle = scrollProgress < 0.04
  const idleTiltX = isIdle ? mouseTilt.y : mouseTilt.y * (1 - pOpen)
  const idleTiltY = isIdle ? mouseTilt.x : mouseTilt.x * (1 - pOpen)

  return (
    <div
      ref={containerRef}
      id="storytelling-container"
      className="relative w-full"
      style={{ height: '420vh' }}
    >
      {/* ── STICKY VIEWPORT (100dvh) ────────────────────────────────────────── */}
      <div
        id="storytelling-sticky"
        className="sticky top-0 w-full h-[100dvh] overflow-hidden bg-gradient-to-b from-[#080A0F] via-[#121620] to-[#06080D] select-none"
      >
        {/* Ambient Golden Particle Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-0 pointer-events-none"
          style={{ opacity: 1 - pDock }}
        />

        {/* ── SLEEK FLOATING BRAND HEADER (At top of screen) ─────────────────── */}
        <header
          className="absolute top-0 inset-x-0 z-50 px-6 sm:px-10 py-5 flex items-center justify-between border-b border-amber-500/10 backdrop-blur-md bg-black/30 transition-opacity duration-300"
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
                Royal Galas &bull; Stadium Concerts &bull; Mega Celebrations
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

        {/* ── STAGE 1: THE EXCLUSIVE 2-FOLD CELEBRATION INVITATION PASS ───────── */}
        {cardOpacity > 0.01 && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
            style={{
              perspective: '1600px',
              opacity: cardOpacity,
              transform: `scale(${cardZoom})`,
              transition: 'opacity 0.2s ease',
            }}
          >
            {/* Card Rig: Shifts to keep open spread centered */}
            <div
              className="relative transition-transform duration-75 ease-out"
              style={{
                transformStyle: 'preserve-3d',
                transform: `translateX(${cardShiftX}px) rotateX(${idleTiltX}deg) rotateY(${idleTiltY}deg)`,
              }}
            >
              {/* Card Container: Single page dimensions */}
              <div
                className="relative rounded-2xl shadow-2xl"
                style={{
                  width: 'min(370px, 86vw)',
                  height: 'min(530px, 68vh)',
                  transformStyle: 'preserve-3d',
                  boxShadow:
                    '0 35px 90px -20px rgba(0,0,0,0.95), 0 0 60px rgba(212,175,55,0.25)',
                }}
              >
                {/* 1. RIGHT INNER PAGE (Base page underneath front cover) */}
                <div
                  className="absolute inset-0 rounded-2xl p-6 sm:p-8 flex flex-col justify-between border-2 border-amber-500/30 shadow-inner overflow-hidden"
                  style={{
                    background:
                      'linear-gradient(145deg, #10131B 0%, #1A202E 50%, #0D1017 100%)',
                  }}
                >
                  {/* Modern geometric gold accent border */}
                  <div className="absolute inset-3 rounded-xl border border-amber-400/20 pointer-events-none" />

                  {/* Top Header Badge */}
                  <div className="relative z-10 flex items-center justify-between text-amber-400/80 text-[10px] tracking-widest font-mono uppercase">
                    <span>STAGE ACCESS</span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      LIVE PASS
                    </span>
                  </div>

                  {/* Portal Graphic on Right Page */}
                  <div className="relative z-10 text-center space-y-4">
                    {/* Glowing Architectural Gate Emblem */}
                    <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border border-amber-400/30 animate-spin" style={{ animationDuration: '20s' }} />
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500/20 to-yellow-500/5 border-2 border-amber-400/60 flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.3)] backdrop-blur-sm">
                        <Sparkles className="w-8 h-8 text-amber-300 animate-pulse" />
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] tracking-[0.25em] font-sans text-amber-300/80 uppercase font-bold">
                        The Grand Portal
                      </span>
                      <h4 className="font-outfit text-xl sm:text-2xl font-bold text-white tracking-tight mt-1">
                        Portal of Splendor
                      </h4>
                    </div>

                    <p className="font-outfit text-xs text-amber-100/70 leading-relaxed max-w-xs mx-auto">
                      Step into an arena of monumental stages, royal banquets, and world-class celebrations.
                    </p>

                    <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-400/40 text-[11px] text-amber-300 uppercase tracking-widest font-semibold shadow-md">
                      <span>Scroll to Step Inside</span>
                      <span>&darr;</span>
                    </div>
                  </div>

                  {/* Bottom Verification Footer */}
                  <div className="relative z-10 flex items-center justify-between text-amber-300/60 text-[9px] font-mono tracking-wider">
                    <span>SECURE DIRECTORY</span>
                    <span>ALL-EVENT ACCESS</span>
                  </div>
                </div>

                {/* 2. THE BOOK-FOLD COVER (Flips -180deg to the Left) */}
                <div
                  className="absolute inset-0 rounded-2xl transition-transform ease-out"
                  style={{
                    transformOrigin: 'left center',
                    transformStyle: 'preserve-3d',
                    transform: `rotateY(${bookHingeDeg}deg)`,
                  }}
                >
                  {/* FRONT FACE OF COVER (Seen when closed — Modern Luxury VIP Pass) */}
                  <div
                    className="absolute inset-0 rounded-2xl p-7 sm:p-9 flex flex-col justify-between border-2 border-amber-400/40 shadow-2xl overflow-hidden"
                    style={{
                      background:
                        'linear-gradient(145deg, #131722 0%, #1D2333 45%, #0F121B 100%)',
                      backfaceVisibility: 'hidden',
                    }}
                  >
                    {/* Metallic Gold Framing & Geometric Accents */}
                    <div className="absolute inset-3 rounded-xl border border-amber-400/30 pointer-events-none" />
                    <div className="absolute inset-5 rounded-lg border border-amber-400/15 pointer-events-none" />

                    {/* Subtle Holographic Sheen Line */}
                    <div
                      className="absolute -inset-x-20 top-1/3 h-24 bg-gradient-to-r from-transparent via-amber-400/10 to-transparent -rotate-45 pointer-events-none"
                    />

                    {/* Top Row: VIP Pass Header */}
                    <div className="relative z-10 flex items-center justify-between text-amber-300/90 text-[10px] font-mono tracking-widest uppercase">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-bold">EXCLUSIVE ACCESS PASS</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30 text-[9px]">
                        EDITION 2026
                      </span>
                    </div>

                    {/* Center Brand Crest & Monogram */}
                    <div className="relative z-10 text-center space-y-4">
                      {/* Geometric Faceted Monogram Emblem */}
                      <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 via-amber-600 to-yellow-700 p-[2px] shadow-[0_0_35px_rgba(212,175,55,0.4)]">
                        <div className="w-full h-full bg-[#121622] rounded-2xl flex items-center justify-center">
                          <span className="font-outfit text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400">
                            E
                          </span>
                        </div>
                      </div>

                      <div>
                        <h2 className="font-outfit text-2xl sm:text-3xl font-black tracking-[0.2em] text-white">
                          EVENTALOGY
                        </h2>
                        <p className="text-[10px] sm:text-xs font-extrabold tracking-[0.35em] text-amber-400 uppercase mt-1">
                          INTERNATIONAL
                        </p>
                      </div>

                      <div className="flex items-center justify-center gap-2 text-amber-400/60 text-xs">
                        <div className="w-8 h-[1px] bg-amber-400/30" />
                        <span>✦</span>
                        <div className="w-8 h-[1px] bg-amber-400/30" />
                      </div>

                      <p className="text-[11px] sm:text-xs font-medium tracking-[0.18em] text-amber-200/90 uppercase">
                        The Grand Celebration
                      </p>

                      <p className="text-[10px] text-zinc-400 tracking-wider">
                        Galas &bull; Concerts &bull; Festivals &bull; Summits
                      </p>
                    </div>

                    {/* Bottom Pass Barcode & Security Badge */}
                    <div className="relative z-10 pt-4 border-t border-amber-400/20 flex items-center justify-between">
                      <div className="text-left font-mono">
                        <p className="text-[8px] text-zinc-500 uppercase tracking-wider">Pass Holder</p>
                        <p className="text-[10px] font-bold text-amber-200">HONOURED GUEST</p>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex gap-[2px] h-4 items-center opacity-70">
                          {[2, 4, 1, 3, 2, 5, 2, 4, 1, 3, 2, 4].map((h, i) => (
                            <div key={i} className="w-[2px] bg-amber-400" style={{ height: `${h * 3}px` }} />
                          ))}
                        </div>
                        <span className="text-[8px] font-mono text-zinc-500 tracking-widest mt-0.5">EV-00892</span>
                      </div>
                    </div>
                  </div>

                  {/* BACK FACE OF COVER (Becomes the Left Inner Page when open!) */}
                  <div
                    className="absolute inset-0 rounded-2xl p-7 sm:p-9 flex flex-col justify-between border-2 border-amber-400/40 shadow-inner overflow-hidden"
                    style={{
                      background:
                        'linear-gradient(145deg, #111520 0%, #1A202D 50%, #0E1118 100%)',
                      transform: 'rotateY(180deg)',
                      backfaceVisibility: 'hidden',
                    }}
                  >
                    <div className="absolute inset-3 rounded-xl border border-amber-400/20 pointer-events-none" />

                    <div className="relative z-10 flex items-center justify-between text-amber-400/80 text-[10px] font-mono tracking-widest uppercase">
                      <span className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                        ACCESS AUTHORIZED
                      </span>
                      <span>VIP TIER</span>
                    </div>

                    <div className="relative z-10 text-center space-y-3">
                      <div className="inline-block px-3 py-1 rounded-full bg-amber-500/10 border border-amber-400/30 text-[10px] font-semibold tracking-[0.2em] text-amber-300 uppercase">
                        Worldwide Directorate
                      </div>

                      <h3 className="font-outfit text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                        Where Extraordinary <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400">
                          Moments Come Alive
                        </span>
                      </h3>

                      <p className="font-outfit text-xs text-zinc-300 leading-relaxed max-w-xs mx-auto">
                        From heritage amphitheaters and luxury coastal arenas to royal galas and international summits — Eventalogy International orchestrates world-class celebrations down to the finest detail.
                      </p>

                      <div className="pt-2 flex justify-center gap-2 flex-wrap">
                        {['Stadium Concerts', 'Royal Galas', 'Global Summits'].map((badge) => (
                          <span key={badge} className="px-2.5 py-0.5 rounded-md bg-white/5 border border-amber-400/20 text-[10px] text-amber-200/90">
                            {badge}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="relative z-10 pt-3 border-t border-amber-400/20 flex items-center justify-between text-[9px] font-mono text-zinc-400">
                      <span>450+ VERIFIED VENUES</span>
                      <span>100% ESCROW ASSURED</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STAGE 2: DREAMY GOLDEN ROLLING CLOUDS / MIST TRANSITION ─────────── */}
        <div
          className="absolute inset-0 z-20 pointer-events-none transition-opacity duration-300"
          style={{ opacity: cloudOpacity }}
        >
          {/* Billowing ambient mist */}
          <div
            className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] blur-3xl opacity-80"
            style={{
              background:
                'radial-gradient(circle at 50% 50%, rgba(245, 215, 130, 0.45) 0%, rgba(180, 120, 30, 0.35) 45%, rgba(10, 15, 25, 0.85) 80%)',
            }}
          />
          <div
            className="absolute top-1/4 right-0 w-[600px] h-[600px] rounded-full blur-2xl opacity-60"
            style={{
              background:
                'radial-gradient(circle, rgba(255, 235, 170, 0.7) 0%, rgba(212, 175, 55, 0.3) 50%, transparent 100%)',
            }}
          />
          <div
            className="absolute bottom-0 left-10 w-[700px] h-[500px] rounded-full blur-3xl opacity-70"
            style={{
              background:
                'radial-gradient(circle, rgba(255, 220, 130, 0.6) 0%, rgba(160, 95, 20, 0.4) 50%, transparent 100%)',
            }}
          />
        </div>

        {/* ── STAGE 3: THE MONUMENTAL GRAND PALACE & ARENA GATEWAY ────────────── */}
        {gateOpacity > 0.01 && (
          <div
            className="absolute inset-0 flex items-center justify-center z-25 pointer-events-none"
            style={{
              perspective: '1400px',
              opacity: gateOpacity,
              transform: `scale(${gateScale})`,
              transition: 'opacity 0.2s ease',
            }}
          >
            {/* Monumental Architectural Gateway Rig */}
            <div
              className="relative flex flex-col items-center justify-center"
              style={{
                width: 'min(780px, 94vw)',
                height: 'min(680px, 85vh)',
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Grand Gateway Frame */}
              <div className="relative w-full h-full flex flex-col items-center">
                {/* Crown Royal Finial & Crest */}
                <div className="relative z-20 flex flex-col items-center -mb-2">
                  <div className="w-14 h-14 rounded-2xl border-2 border-amber-400 bg-gradient-to-br from-amber-400 via-amber-600 to-yellow-700 flex items-center justify-center shadow-[0_0_35px_rgba(212,175,55,0.7)] text-white">
                    <Sparkles className="w-7 h-7 text-white" />
                  </div>
                  <div className="w-1 h-6 bg-gradient-to-b from-amber-400 to-transparent" />
                </div>

                {/* Main Arch Structure */}
                <div
                  className="relative w-full flex-1 rounded-t-[260px] border-8 border-amber-400 shadow-[0_0_80px_rgba(212,175,55,0.35)] flex overflow-hidden"
                  style={{
                    background:
                      'radial-gradient(circle at 50% 40%, #2A2016 0%, #0F121A 80%)',
                    perspective: '1000px',
                  }}
                >
                  {/* Ornate Gold Arch Header Trim */}
                  <div className="absolute top-0 inset-x-0 h-10 border-b-2 border-amber-400/40 flex items-center justify-around z-30">
                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                      <div
                        key={i}
                        className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 shadow-[0_0_12px_rgba(255,180,40,0.8)]"
                      />
                    ))}
                  </div>

                  {/* Left Architectural Palace Lantern */}
                  <div className="absolute top-20 left-8 z-30 flex flex-col items-center">
                    <div className="w-2 h-8 bg-[#8C6B1F]" />
                    <div className="w-10 h-14 rounded-lg border-2 border-amber-400 bg-amber-400 shadow-[0_0_35px_10px_rgba(255,200,80,0.9)] animate-pulse flex items-center justify-center">
                      <div className="w-3 h-5 bg-white rounded-full blur-[1px]" />
                    </div>
                  </div>

                  {/* Right Architectural Palace Lantern */}
                  <div className="absolute top-20 right-8 z-30 flex flex-col items-center">
                    <div className="w-2 h-8 bg-[#8C6B1F]" />
                    <div className="w-10 h-14 rounded-lg border-2 border-amber-400 bg-amber-400 shadow-[0_0_35px_10px_rgba(255,200,80,0.9)] animate-pulse flex items-center justify-center">
                      <div className="w-3 h-5 bg-white rounded-full blur-[1px]" />
                    </div>
                  </div>

                  {/* LEFT PALACE GATE DOOR (Swings outward) */}
                  <div
                    className="w-1/2 h-full bg-gradient-to-r from-[#171A24] via-[#242A38] to-[#141822] border-r border-amber-400/80 flex flex-col justify-around p-8 transition-transform origin-left z-20 shadow-2xl"
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: `rotateY(${-gateDoorsOpenDeg}deg)`,
                    }}
                  >
                    {/* Brass Studs & Medallions on Left Door */}
                    <div className="space-y-8">
                      {[1, 2, 3].map((r) => (
                        <div key={r} className="flex justify-around">
                          <div className="w-4 h-4 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(212,175,55,0.8)]" />
                          <div className="w-4 h-4 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(212,175,55,0.8)]" />
                        </div>
                      ))}
                    </div>

                    {/* Royal Door Handle */}
                    <div className="self-end mr-2 w-14 h-14 rounded-full border-4 border-amber-400 bg-[#2A3142] flex items-center justify-center shadow-lg">
                      <div className="w-4 h-4 rounded-full bg-amber-400" />
                    </div>
                  </div>

                  {/* RIGHT PALACE GATE DOOR (Swings outward) */}
                  <div
                    className="w-1/2 h-full bg-gradient-to-l from-[#171A24] via-[#242A38] to-[#141822] border-l border-amber-400/80 flex flex-col justify-around p-8 transition-transform origin-right z-20 shadow-2xl"
                    style={{
                      transformStyle: 'preserve-3d',
                      transform: `rotateY(${gateDoorsOpenDeg}deg)`,
                    }}
                  >
                    {/* Brass Studs & Medallions on Right Door */}
                    <div className="space-y-8">
                      {[1, 2, 3].map((r) => (
                        <div key={r} className="flex justify-around">
                          <div className="w-4 h-4 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(212,175,55,0.8)]" />
                          <div className="w-4 h-4 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(212,175,55,0.8)]" />
                        </div>
                      ))}
                    </div>

                    {/* Royal Door Handle */}
                    <div className="self-start ml-2 w-14 h-14 rounded-full border-4 border-amber-400 bg-[#2A3142] flex items-center justify-center shadow-lg">
                      <div className="w-4 h-4 rounded-full bg-amber-400" />
                    </div>
                  </div>

                  {/* BEHIND THE GATES: Radiant Golden Burst (Revealed as doors open) */}
                  <div
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-6 transition-opacity duration-300"
                    style={{ opacity: Math.min(1, pGateDoors * 2) }}
                  >
                    {/* Volumetric Light Burst */}
                    <div className="w-72 h-72 rounded-full bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 blur-3xl opacity-80 animate-pulse" />
                    <span className="font-outfit text-white text-xl sm:text-2xl font-bold tracking-widest uppercase relative z-20 drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)]">
                      Entering The Celebration
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STAGE 4: THE LIVING CELEBRATION HALL (Real event in progress) ─────── */}
        <div
          className="absolute inset-0 z-30 pointer-events-none flex flex-col items-center justify-center text-center px-6 transition-opacity duration-500 overflow-hidden"
          style={{
            opacity: Math.max(0, Math.min(1, pCeleb * 1.5 - pDock * 1.5)),
          }}
        >
          {/* High-Definition Luxury Event Backdrop (Real Celebration in progress) */}
          <div
            className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-700"
            style={{
              backgroundImage:
                'url("https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=2000&auto=format&fit=crop")',
              transform: `scale(${1 + (1 - pCeleb) * 0.1})`,
            }}
          />

          {/* Luxury Warm Amber Overlay & Vignette */}
          <div
            className="absolute inset-0 z-1"
            style={{
              background:
                'radial-gradient(circle at 50% 45%, rgba(15, 20, 30, 0.72) 0%, rgba(8, 10, 16, 0.92) 80%, #05060A 100%)',
            }}
          />

          {/* Sweeping Concert Spotlight Beams */}
          <div
            className="absolute -top-32 left-1/4 w-44 h-[900px] opacity-40 transform -rotate-12 blur-3xl pointer-events-none z-2"
            style={{
              background:
                'linear-gradient(180deg, rgba(255, 235, 160, 0.85) 0%, rgba(212, 175, 55, 0.2) 60%, transparent 100%)',
            }}
          />
          <div
            className="absolute -top-32 right-1/4 w-44 h-[900px] opacity-40 transform rotate-12 blur-3xl pointer-events-none z-2"
            style={{
              background:
                'linear-gradient(180deg, rgba(255, 235, 160, 0.85) 0%, rgba(212, 175, 55, 0.2) 60%, transparent 100%)',
            }}
          />

          {/* Celebration Hall Content Overlay */}
          <div className="relative z-10 max-w-4xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs sm:text-sm font-semibold tracking-widest uppercase shadow-xl backdrop-blur-md">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>You Have Arrived At The Celebration</span>
            </div>

            <h1 className="font-outfit text-4xl sm:text-6xl md:text-7xl font-black text-white tracking-tight leading-[1.08] drop-shadow-2xl">
              Curating <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400">Extraordinary</span> Celebrations Worldwide.
            </h1>

            <p className="text-base sm:text-lg text-amber-100/90 leading-relaxed font-light max-w-2xl mx-auto drop-shadow-lg">
              From stadium concerts and international business summits to royal heritage galas and luxury beachfront festivities —{' '}
              <strong className="text-amber-300 font-semibold">Eventalogy International</strong> is your complete global production partner.
            </p>

            {/* Event Category Badges */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {[
                'Stadium Concerts',
                'Royal Galas & Forts',
                'Global Summits',
                'Beachfront Festivals',
                'VIP Banquets',
              ].map((cat) => (
                <span
                  key={cat}
                  className="px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-black/40 backdrop-blur-md border border-amber-300/40 text-amber-100 shadow-md"
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
              Scroll to Open Invitation Pass
            </span>
            <ChevronDown className="w-5 h-5 text-amber-300" />
          </div>
        )}

        {/* ── STAGE 5: SMOOTH BACKGROUND TRANSITION TO WARM IVORY ──────────────── */}
        <div
          className="absolute inset-0 z-35 pointer-events-none transition-opacity duration-300 bg-[#FAF8F5]"
          style={{ opacity: pDock }}
        />
      </div>

      {/* ── STAGE 5 DOCKING: THE 3 GATEWAY HUBS (SLIDES UP SMOOTHLY) ─────────── */}
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
                Schedule a direct consultation with an Eventalogy Senior Director for high-profile events,
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
