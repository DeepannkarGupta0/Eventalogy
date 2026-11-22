'use client'

import { useEffect, useRef, useState } from 'react'

export function useScrollProgress(containerRef: React.RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0)
  const rafId = useRef<number | undefined>(undefined)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      if (rafId.current !== undefined) return
      rafId.current = requestAnimationFrame(() => {
        rafId.current = undefined
        const rect = container.getBoundingClientRect()
        const totalScrollable = container.offsetHeight - window.innerHeight
        if (totalScrollable <= 0) {
          setProgress(0)
          return
        }
        const scrolled = -rect.top
        const p = Math.max(0, Math.min(1, scrolled / totalScrollable))
        setProgress(p)
      })
    }

    // Initial check
    handleScroll()

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
      if (rafId.current !== undefined) {
        cancelAnimationFrame(rafId.current)
        rafId.current = undefined
      }
    }
  }, [containerRef])

  return progress
}
