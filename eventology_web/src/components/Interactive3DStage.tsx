"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Sparkles, Crown, Zap, GlassWater, Flame, RotateCw } from "lucide-react";

type MoodKey = "wedding" | "concert" | "gala" | "sunset";

const MOODS: Record<
  MoodKey,
  {
    name: string;
    description: string;
    icon: typeof Crown;
    primaryLight: number;
    secondaryLight: number;
    ambientColor: number;
    badgeBg: string;
    badgeText: string;
  }
> = {
  wedding: {
    name: "Royal Palace Wedding",
    description: "Warm golden chandeliers, fairy-lit floral arches, and regal ambient glow.",
    icon: Crown,
    primaryLight: 0xffd700,
    secondaryLight: 0xffaa00,
    ambientColor: 0x332211,
    badgeBg: "bg-amber-500/20 border-amber-500/40",
    badgeText: "text-amber-300",
  },
  concert: {
    name: "Stadium Music Concert",
    description: "High-energy cyan & magenta beam lights, concert trussing, and strobe accents.",
    icon: Zap,
    primaryLight: 0x00ffff,
    secondaryLight: 0xff007f,
    ambientColor: 0x0a1025,
    badgeBg: "bg-cyan-500/20 border-cyan-500/40",
    badgeText: "text-cyan-300",
  },
  gala: {
    name: "Black-Tie Corporate Gala",
    description: "Refined architectural downlights, platinum sheen, and keynote staging.",
    icon: GlassWater,
    primaryLight: 0xe0e7ff,
    secondaryLight: 0x6366f1,
    ambientColor: 0x111322,
    badgeBg: "bg-indigo-500/20 border-indigo-500/40",
    badgeText: "text-indigo-300",
  },
  sunset: {
    name: "Goa Sunset Soiree",
    description: "Warm terracotta, coral dusk hues, and open-air beachfront ambience.",
    icon: Flame,
    primaryLight: 0xff7a59,
    secondaryLight: 0x9333ea,
    ambientColor: 0x221015,
    badgeBg: "bg-rose-500/20 border-rose-500/40",
    badgeText: "text-rose-300",
  },
};

export default function Interactive3DStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeMood, setActiveMood] = useState<MoodKey>("wedding");
  const lightsRef = useRef<{
    point1?: THREE.PointLight;
    point2?: THREE.PointLight;
    ambient?: THREE.AmbientLight;
  }>({});

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 5, 13);
    camera.lookAt(0, 0.5, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Group containing the entire 3D stage model
    const stageGroup = new THREE.Group();
    scene.add(stageGroup);

    // 1. Stage Platform Deck (Double Riser)
    const deckGeo = new THREE.CylinderGeometry(4.5, 4.8, 0.4, 32);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x1c1e28,
      metalness: 0.6,
      roughness: 0.4,
    });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.y = -0.2;
    stageGroup.add(deck);

    // Golden Stage Rim
    const rimGeo = new THREE.TorusGeometry(4.65, 0.08, 16, 64);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.9,
      roughness: 0.2,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    stageGroup.add(rim);

    // 2. Architectural Pillars / Mandap Arch Structure
    const pillarGeo = new THREE.CylinderGeometry(0.14, 0.16, 4.2, 16);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.8,
      roughness: 0.25,
    });

    const pillarCoords = [
      [-2.4, 1.9, -1.8],
      [2.4, 1.9, -1.8],
      [-2.4, 1.9, 1.8],
      [2.4, 1.9, 1.8],
    ];

    pillarCoords.forEach(([x, y, z]) => {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(x, y, z);
      stageGroup.add(pillar);
    });

    // 3. Canopy Crown Truss
    const crownGeo = new THREE.TorusGeometry(3.1, 0.12, 16, 48);
    const crown = new THREE.Mesh(crownGeo, pillarMat);
    crown.rotation.x = Math.PI / 2;
    crown.position.y = 4.0;
    stageGroup.add(crown);

    // 4. Central Focal Element (Floating Diamond / Prism)
    const focalGeo = new THREE.OctahedronGeometry(0.85, 0);
    const focalMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.1,
      wireframe: false,
    });
    const focal = new THREE.Mesh(focalGeo, focalMat);
    focal.position.y = 2.0;
    stageGroup.add(focal);

    // 5. Lights
    const currentConfig = MOODS[activeMood];
    const ambientLight = new THREE.AmbientLight(currentConfig.ambientColor, 1.2);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(currentConfig.primaryLight, 4, 30);
    pointLight1.position.set(4, 5, 4);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(currentConfig.secondaryLight, 3.5, 30);
    pointLight2.position.set(-4, 5, -3);
    scene.add(pointLight2);

    lightsRef.current = {
      point1: pointLight1,
      point2: pointLight2,
      ambient: ambientLight,
    };

    // 6. Mouse Drag Interaction for 360° Rotation
    let isDragging = false;
    let prevMouseX = 0;
    let rotationVelocity = 0.005;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      prevMouseX = e.clientX;
      stageGroup.rotation.y += deltaX * 0.01;
      rotationVelocity = deltaX * 0.003;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouseX = e.touches[0].clientX;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - prevMouseX;
      prevMouseX = e.touches[0].clientX;
      stageGroup.rotation.y += deltaX * 0.01;
      rotationVelocity = deltaX * 0.003;
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    // 7. Render Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      // Slow continuous spin when not actively dragging
      if (!isDragging) {
        stageGroup.rotation.y += rotationVelocity;
        rotationVelocity *= 0.96; // damping
        if (Math.abs(rotationVelocity) < 0.003) {
          rotationVelocity = 0.003;
        }
      }

      // Floating central crystal
      focal.rotation.y = time * 0.8;
      focal.position.y = 2.0 + Math.sin(time * 1.5) * 0.15;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);

      deckGeo.dispose();
      deckMat.dispose();
      rimGeo.dispose();
      rimMat.dispose();
      pillarGeo.dispose();
      pillarMat.dispose();
      crownGeo.dispose();
      focalGeo.dispose();
      focalMat.dispose();
      renderer.dispose();
    };
  }, []);

  // Update lighting smoothly when mood changes
  useEffect(() => {
    const config = MOODS[activeMood];
    if (lightsRef.current.point1) {
      lightsRef.current.point1.color.setHex(config.primaryLight);
    }
    if (lightsRef.current.point2) {
      lightsRef.current.point2.color.setHex(config.secondaryLight);
    }
    if (lightsRef.current.ambient) {
      lightsRef.current.ambient.color.setHex(config.ambientColor);
    }
  }, [activeMood]);

  const CurrentIcon = MOODS[activeMood].icon;

  return (
    <div className="relative w-full rounded-3xl border border-white/10 bg-gradient-to-b from-[#141824] via-[#0E111C] to-[#08090E] p-6 sm:p-10 shadow-2xl overflow-hidden">
      {/* Background ambient radial glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(212,175,55,0.12),transparent_70%)]" />

      {/* Top Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3.5 py-1 text-xs font-bold text-[#FFD700] uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Interactive 3D Stage Studio</span>
          </div>
          <h3 className="font-syne text-2xl sm:text-3xl font-black text-white mt-2">
            Visualize Your Celebration in 3D
          </h3>
          <p className="text-sm text-slate-300 mt-1 max-w-xl">
            Drag to rotate the 3D stage in 360°. Switch celebration lighting styles to experience how your venue transforms.
          </p>
        </div>

        {/* 360 Hint */}
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-mono text-slate-300">
          <RotateCw className="h-4 w-4 text-[#FFD700] animate-spin" style={{ animationDuration: "8s" }} />
          <span>Interactive 360° Drag</span>
        </div>
      </div>

      {/* Mood Selector Buttons */}
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6">
        {(Object.keys(MOODS) as MoodKey[]).map((key) => {
          const item = MOODS[key];
          const IconComponent = item.icon;
          const isActive = activeMood === key;

          return (
            <button
              key={key}
              onClick={() => setActiveMood(key)}
              className={`flex items-center gap-2.5 rounded-2xl p-3.5 text-left transition-all border ${
                isActive
                  ? `${item.badgeBg} border-2 shadow-lg scale-[1.02]`
                  : "border-white/10 bg-white/5 hover:bg-white/10 text-slate-300"
              }`}
            >
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${
                  isActive ? "bg-white/20" : "bg-black/40"
                }`}
              >
                <IconComponent className={`h-4 w-4 ${isActive ? item.badgeText : "text-slate-400"}`} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-xs text-white truncate">{item.name}</p>
                <p className="text-[10px] text-slate-400 truncate">Lighting Ambience</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 3D Canvas Viewport */}
      <div className="relative mt-6 h-72 sm:h-96 w-full rounded-2xl border border-white/10 bg-black/60 overflow-hidden cursor-grab active:cursor-grabbing flex items-center justify-center">
        <canvas ref={canvasRef} className="h-full w-full" />

        {/* Bottom Floating Info Pill */}
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 sm:left-auto sm:right-6 rounded-xl border border-white/15 bg-black/80 backdrop-blur-md px-4 py-2.5 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <p className="text-xs text-slate-200">
            <span className="font-bold text-[#FFD700]">{MOODS[activeMood].name}: </span>
            {MOODS[activeMood].description}
          </p>
        </div>
      </div>
    </div>
  );
}
