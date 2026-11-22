'use client'

import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  clamp,
  lerp,
  phaseProgress,
  easeInOutCubic,
  easeOutQuart,
  keyframedValue,
  CAMERA_Z_KEYFRAMES,
  CAMERA_FOV_KEYFRAMES,
} from './scroll/ScrollScrubEngine'
import { createInvitationCard, InvitationCardController } from './scroll/InvitationCard3D'
import { createGrandGatePortal, GrandGateController } from './scroll/GrandGatePortal'
import { CelebrationScene } from './scroll/CelebrationScene'
import { GatewayDock } from './scroll/GatewayDock'

interface StorytellingScrollInnerProps {
  onOpenCallback: () => void
}

export default function StorytellingScrollInner({ onOpenCallback }: StorytellingScrollInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [scrollProgress, setScrollProgress] = useState(0)
  const [isReducedMotion, setIsReducedMotion] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // Detect reduced motion & mobile
    const prm = window.matchMedia('(prefers-reduced-motion: reduce)')
    setIsReducedMotion(prm.matches)
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile, { passive: true })
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (isReducedMotion) return
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    // Register GSAP ScrollTrigger
    gsap.registerPlugin(ScrollTrigger)

    // Three.js Scene Setup
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    )
    camera.position.set(0, 0, 5.5)

    // Warm Atmospheric Lighting
    const ambientLight = new THREE.AmbientLight(0xfff6e6, 1.3)
    scene.add(ambientLight)

    const mainLight = new THREE.DirectionalLight(0xffdf88, 2.2)
    mainLight.position.set(3, 4, 5)
    scene.add(mainLight)

    const fillLight = new THREE.DirectionalLight(0xe8c872, 1.0)
    fillLight.position.set(-3, -2, 3)
    scene.add(fillLight)

    // Golden Sparkle Particle System (Phase 3 & 4 depth)
    const sparkleCount = isMobile ? 350 : 800
    const sparkleGeo = new THREE.BufferGeometry()
    const sparklePositions = new Float32Array(sparkleCount * 3)
    const sparkleVelocities = new Float32Array(sparkleCount)

    for (let i = 0; i < sparkleCount; i++) {
      sparklePositions[i * 3 + 0] = (Math.random() - 0.5) * 7
      sparklePositions[i * 3 + 1] = (Math.random() - 0.5) * 6
      sparklePositions[i * 3 + 2] = (Math.random() - 0.5) * 5 - 0.5
      sparkleVelocities[i] = 0.001 + Math.random() * 0.0025
    }
    sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePositions, 3))
    const sparkleMat = new THREE.PointsMaterial({
      color: new THREE.Color('#FFD700'),
      size: isMobile ? 0.03 : 0.038,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const sparkles = new THREE.Points(sparkleGeo, sparkleMat)
    scene.add(sparkles)

    // Build 3D Entities
    let cardCtrl: InvitationCardController | null = null
    let gateCtrl: GrandGateController | null = null

    try {
      cardCtrl = createInvitationCard(scene)
      gateCtrl = createGrandGatePortal(scene)
    } catch (err) {
      console.error('Three.js scene creation error:', err)
    }

    // Mouse Parallax
    const mouse = { x: 0, y: 0 }
    const targetMouse = { x: 0, y: 0 }
    const handleMouseMove = (e: MouseEvent) => {
      targetMouse.x = (e.clientX / window.innerWidth - 0.5) * 2
      targetMouse.y = (e.clientY / window.innerHeight - 0.5) * 2
    }
    window.addEventListener('mousemove', handleMouseMove, { passive: true })

    // Resize handler
    const handleResize = () => {
      if (!canvas) return
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    }
    window.addEventListener('resize', handleResize, { passive: true })

    // Scroll Progress tracker & GSAP ScrollTrigger
    let currentProgress = 0
    let targetProgress = 0

    const trigger = ScrollTrigger.create({
      trigger: container,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.2,
      onUpdate: (self) => {
        targetProgress = self.progress
        setScrollProgress(self.progress)
      },
    })

    // RAF Animation Loop
    let animId: number
    let clock = 0

    const animate = (time: number) => {
      animId = requestAnimationFrame(animate)
      clock = time

      // Smooth mouse lerp
      mouse.x += (targetMouse.x - mouse.x) * 0.06
      mouse.y += (targetMouse.y - mouse.y) * 0.06

      // Smooth progress scrub lerp for ultra-fluid cinematic motion
      currentProgress += (targetProgress - currentProgress) * 0.1
      const p = currentProgress

      // ── PHASE 1: IDLE / AMBIENT REVOLVE (p < 0.03) ────────────────────────
      const isIdle = p < 0.03

      if (cardCtrl) {
        cardCtrl.updateIdle(time, mouse, isIdle)
        cardCtrl.updateLanternFlicker(time)
      }

      // ── CAMERA INTERPOLATION ACROSS ALL PHASES ─────────────────────────────
      const camZ = keyframedValue(CAMERA_Z_KEYFRAMES, p)
      const camFOV = keyframedValue(CAMERA_FOV_KEYFRAMES, p)
      camera.position.z = camZ
      camera.fov = camFOV
      camera.updateProjectionMatrix()

      // ── PHASE 2: CARD FLAT & OPEN LIKE A BOOK (0.0 to 0.25) ───────────────
      const p2 = phaseProgress(p, 0.0, 0.25)
      if (cardCtrl) {
        if (p >= 0.03) {
          // Snap card group rotation towards dead-ahead
          cardCtrl.cardGroup.rotation.y = lerp(cardCtrl.cardGroup.rotation.y, 0, 0.15)
          cardCtrl.cardGroup.position.y = lerp(cardCtrl.cardGroup.position.y, 0, 0.15)
          cardCtrl.cardGroup.rotation.x = lerp(cardCtrl.cardGroup.rotation.x, 0, 0.15)
          cardCtrl.cardGroup.rotation.z = lerp(cardCtrl.cardGroup.rotation.z, 0, 0.15)
        }
        // Swing right panel open around spine (-160 degrees)
        const hingeAngle = lerp(0, -Math.PI * (160 / 180), easeInOutCubic(p2))
        cardCtrl.setHingeAngle(hingeAngle)
      }

      // ── PHASE 3 & 4: DIVE THROUGH CARD INTO GRAND GATE (0.40 to 0.75) ─────
      const p4 = phaseProgress(p, 0.45, 0.75)

      // Card dissolves as camera punches through card surface
      if (cardCtrl) {
        const cardOpacity = 1 - easeInOutCubic(phaseProgress(p, 0.5, 0.65))
        cardCtrl.setOpacity(cardOpacity)
      }

      // Grand Gate materializes & opens doors
      if (gateCtrl) {
        const gateOpacity = easeInOutCubic(phaseProgress(p, 0.45, 0.62))
        gateCtrl.setOpacity(gateOpacity)

        // Doors open once camera is within proximity
        const doorProgress = easeOutQuart(clamp((p4 - 0.35) / 0.65, 0, 1))
        gateCtrl.setGateOpen(doorProgress)
        gateCtrl.updateAnimation(time)
      }

      // ── SPARKLES DRIFT UPWARD ─────────────────────────────────────────────
      const sparkleOpacity = lerp(0.15, 0.65, phaseProgress(p, 0.25, 0.75))
      sparkleMat.opacity = sparkleOpacity * (1 - phaseProgress(p, 0.85, 1.0))
      const positions = sparkleGeo.attributes.position.array as Float32Array
      for (let i = 0; i < sparkleCount; i++) {
        positions[i * 3 + 1] += sparkleVelocities[i]
        if (positions[i * 3 + 1] > 3.5) {
          positions[i * 3 + 1] = -3.5
        }
      }
      sparkleGeo.attributes.position.needsUpdate = true

      // ── RENDER SCENE ───────────────────────────────────────────────────────
      renderer.render(scene, camera)
    }

    animId = requestAnimationFrame(animate)

    // Cleanup on unmount
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)
      trigger.kill()
      cardCtrl?.dispose()
      gateCtrl?.dispose()
      sparkleGeo.dispose()
      sparkleMat.dispose()
      renderer.dispose()
    }
  }, [isReducedMotion, isMobile])

  // Phase progress splits for overlay UI
  const p5 = phaseProgress(scrollProgress, 0.72, 0.88)
  const p6 = phaseProgress(scrollProgress, 0.85, 1.0)
  const showScrollHint = scrollProgress < 0.05

  return (
    <div
      ref={containerRef}
      id="storytelling-container"
      className="relative w-full"
      style={{ height: isReducedMotion ? 'auto' : '360vh' }}
    >
      {/* Sticky Viewport Container */}
      <div
        id="storytelling-sticky"
        className="sticky top-0 w-full h-[100dvh] overflow-hidden bg-gradient-to-b from-[#160E07] via-[#2A1B0E] to-[#120B05]"
      >
        {/* Three.js Canvas */}
        {!isReducedMotion && (
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full z-10 block pointer-events-auto"
            style={{
              opacity: Math.max(0, 1 - p6 * 1.5),
              transition: 'opacity 0.2s ease',
            }}
          />
        )}

        {/* Phase 5: Living Celebration Parallax Scene */}
        <CelebrationScene progress={p5} />

        {/* Phase 1: Scroll to Begin Ambient Hint */}
        {showScrollHint && !isReducedMotion && (
          <div className="absolute bottom-8 inset-x-0 z-30 flex flex-col items-center justify-center pointer-events-none animate-bounce">
            <span className="text-amber-200/70 text-xs font-outfit uppercase tracking-[0.25em] mb-1">
              Scroll to Open Invitation
            </span>
            <div className="w-5 h-8 rounded-full border-2 border-amber-300/40 flex items-start justify-center p-1">
              <div className="w-1.5 h-2 rounded-full bg-amber-400 animate-pulse" />
            </div>
          </div>
        )}

        {/* Phase 6 Background Ivory Fade */}
        <div
          className="absolute inset-0 z-25 pointer-events-none transition-opacity duration-300 bg-[#FAF8F5]"
          style={{ opacity: p6 }}
        />
      </div>

      {/* Phase 6: Gateway Dock (Product Cards slide up seamlessly into the page) */}
      <div className="relative z-30 -mt-[100dvh] min-h-[100dvh] flex flex-col justify-end">
        <GatewayDock progress={p6} onOpenCallback={onOpenCallback} />
      </div>
    </div>
  )
}
