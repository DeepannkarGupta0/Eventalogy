// Pure math and easing utilities for scroll animation scrub
export const clamp = (val: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, val))

export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t

export const inverseLerp = (a: number, b: number, val: number): number =>
  a === b ? 0 : clamp((val - a) / (b - a), 0, 1)

// Get phase-local progress (0-1) from global scroll progress
export const phaseProgress = (
  globalProgress: number,
  phaseStart: number,
  phaseEnd: number
): number => inverseLerp(phaseStart, phaseEnd, globalProgress)

// Standard smooth easing functions
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export const easeOutQuart = (t: number): number =>
  1 - Math.pow(1 - t, 4)

export const easeInQuart = (t: number): number =>
  t * t * t * t

export const easeOutCubic = (t: number): number =>
  1 - Math.pow(1 - t, 3)

export interface Keyframe {
  progress: number
  value: number
}

// Keyframed value interpolation for smooth camera control
export function keyframedValue(keyframes: Keyframe[], progress: number): number {
  if (keyframes.length === 0) return 0
  if (progress <= keyframes[0].progress) return keyframes[0].value
  if (progress >= keyframes[keyframes.length - 1].progress) {
    return keyframes[keyframes.length - 1].value
  }

  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i]
    const b = keyframes[i + 1]
    if (progress >= a.progress && progress <= b.progress) {
      const t = inverseLerp(a.progress, b.progress, progress)
      return lerp(a.value, b.value, t)
    }
  }
  return keyframes[keyframes.length - 1].value
}

// Camera Z position across all phases
// Phase 1 (0%): 5.5
// Phase 2 (25%): 3.8
// Phase 3 (50%): 1.8
// Phase 4 (65%): 0.1
// Phase 4.5 (75%): -3.0 (past gate)
// Phase 5 (85%): -5.0
// Phase 6 (100%): -6.0
export const CAMERA_Z_KEYFRAMES: Keyframe[] = [
  { progress: 0.00, value: 5.5 },
  { progress: 0.25, value: 3.8 },
  { progress: 0.50, value: 1.8 },
  { progress: 0.65, value: 0.1 },
  { progress: 0.75, value: -3.0 },
  { progress: 0.85, value: -5.0 },
  { progress: 1.00, value: -6.0 },
]

export const CAMERA_FOV_KEYFRAMES: Keyframe[] = [
  { progress: 0.00, value: 45 },
  { progress: 0.50, value: 48 },
  { progress: 0.65, value: 70 },
  { progress: 0.80, value: 60 },
  { progress: 1.00, value: 50 },
]
