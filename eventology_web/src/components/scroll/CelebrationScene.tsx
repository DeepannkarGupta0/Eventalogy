'use client'

import React from 'react'

interface CelebrationSceneProps {
  progress: number // Phase 5 progress (0 to 1)
}

export function CelebrationScene({ progress }: CelebrationSceneProps) {
  const visible = progress > 0.01
  const opacity = Math.min(1, progress * 1.5)

  // Parallax offsets
  const layer0Y = progress * -40
  const layer1Y = progress * -20
  const layer2Y = progress * -10

  // Staggered text reveals
  const titleOpacity = Math.max(0, Math.min(1, (progress - 0.15) * 3))
  const titleY = (1 - Math.min(1, (progress - 0.15) * 3)) * 25

  const subOpacity = Math.max(0, Math.min(1, (progress - 0.35) * 3))
  const subY = (1 - Math.min(1, (progress - 0.35) * 3)) * 25

  const tagsOpacity = Math.max(0, Math.min(1, (progress - 0.55) * 3))
  const tagsY = (1 - Math.min(1, (progress - 0.55) * 3)) * 25

  if (!visible) return null

  return (
    <div
      className="absolute inset-0 z-20 pointer-events-none transition-opacity duration-300 overflow-hidden"
      style={{ opacity }}
    >
      {/* Layer 0: Deep Atmospheric Ambient Light Rays */}
      <div
        className="absolute inset-0 bg-radial-vignette"
        style={{
          transform: `translate3d(0, ${layer0Y}px, 0)`,
          background:
            'radial-gradient(circle at 50% 30%, rgba(212, 175, 55, 0.22) 0%, rgba(30, 20, 10, 0.65) 60%, rgba(15, 10, 5, 0.95) 100%)',
        }}
      />

      {/* Layer 1: Warm Golden Concert Beams & Canopy Fairy Lights */}
      <div
        className="absolute inset-0"
        style={{ transform: `translate3d(0, ${layer1Y}px, 0)` }}
      >
        {/* Left Beam */}
        <div
          className="absolute -top-20 left-1/4 w-32 h-[800px] opacity-30 transform -rotate-12 blur-2xl pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(255, 230, 150, 0.6) 0%, rgba(212, 175, 55, 0.1) 60%, transparent 100%)',
          }}
        />
        {/* Right Beam */}
        <div
          className="absolute -top-20 right-1/4 w-32 h-[800px] opacity-30 transform rotate-12 blur-2xl pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(255, 230, 150, 0.6) 0%, rgba(212, 175, 55, 0.1) 60%, transparent 100%)',
          }}
        />

        {/* Bokeh Fairy Light Dots */}
        <div className="absolute inset-0 opacity-70">
          {[
            { top: '15%', left: '18%', size: 8, delay: '0s' },
            { top: '22%', left: '35%', size: 6, delay: '0.5s' },
            { top: '12%', left: '50%', size: 10, delay: '1s' },
            { top: '28%', left: '68%', size: 7, delay: '1.5s' },
            { top: '18%', left: '82%', size: 9, delay: '0.8s' },
            { top: '35%', left: '25%', size: 5, delay: '2s' },
            { top: '40%', left: '75%', size: 8, delay: '1.2s' },
          ].map((dot, idx) => (
            <div
              key={idx}
              className="absolute rounded-full bg-amber-200 blur-[1px] animate-pulse"
              style={{
                top: dot.top,
                left: dot.left,
                width: `${dot.size}px`,
                height: `${dot.size}px`,
                boxShadow: '0 0 16px 4px rgba(255, 220, 120, 0.8)',
                animationDuration: '3s',
                animationDelay: dot.delay,
              }}
            />
          ))}
        </div>
      </div>

      {/* Layer 2: Celebratory Gathering Silhouettes & Ambient Floor */}
      <div
        className="absolute bottom-0 inset-x-0 h-64 pointer-events-none"
        style={{ transform: `translate3d(0, ${layer2Y}px, 0)` }}
      >
        {/* Warm golden footlight glow */}
        <div
          className="absolute bottom-0 inset-x-0 h-40 blur-3xl opacity-40"
          style={{
            background:
              'linear-gradient(0deg, rgba(212, 175, 55, 0.4) 0%, transparent 100%)',
          }}
        />
      </div>

      {/* Narrative Storytelling Typography Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 max-w-4xl mx-auto">
        {/* Subtitle / Prelude */}
        <div
          className="text-amber-300/80 font-serif tracking-[0.25em] text-xs sm:text-sm uppercase mb-3"
          style={{
            opacity: titleOpacity,
            transform: `translate3d(0, ${titleY}px, 0)`,
            transition: 'opacity 0.2s ease, transform 0.2s ease',
          }}
        >
          ✦ You Have Arrived At The Celebration ✦
        </div>

        {/* Main Title */}
        <h2
          className="text-3xl sm:text-5xl md:text-6xl font-light text-white font-outfit tracking-tight leading-[1.15]"
          style={{
            opacity: titleOpacity,
            transform: `translate3d(0, ${titleY}px, 0)`,
            textShadow: '0 4px 30px rgba(0,0,0,0.8)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
          }}
        >
          Every celebration begins with an invitation.
          <br />
          <span className="font-semibold bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
            We make every moment unforgettable.
          </span>
        </h2>

        {/* Story Paragraph */}
        <p
          className="mt-6 text-sm sm:text-lg text-amber-100/80 max-w-2xl font-light leading-relaxed"
          style={{
            opacity: subOpacity,
            transform: `translate3d(0, ${subY}px, 0)`,
            transition: 'opacity 0.2s ease, transform 0.2s ease',
          }}
        >
          From intimate royal galas and bespoke destination weddings to stadium
          concerts and international summits — Eventalogy orchestrates grandeur
          down to the finest heartbeat.
        </p>

        {/* Event Pills */}
        <div
          className="mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3"
          style={{
            opacity: tagsOpacity,
            transform: `translate3d(0, ${tagsY}px, 0)`,
            transition: 'opacity 0.2s ease, transform 0.2s ease',
          }}
        >
          {[
            'Luxury Weddings',
            'Royal Galas',
            'Global Summits',
            'Live Concerts',
            'VIP Receptions',
          ].map((tag) => (
            <span
              key={tag}
              className="px-3.5 py-1.5 rounded-full text-xs sm:text-sm bg-white/10 backdrop-blur-md border border-amber-300/30 text-amber-100 shadow-lg"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
