'use client'

import React from 'react'
import dynamic from 'next/dynamic'

interface StorytellingScrollProps {
  onOpenCallback?: () => void
}

const StorytellingScrollInner = dynamic(
  () => import('./StorytellingScrollInner'),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-[100dvh] flex items-center justify-center bg-gradient-to-b from-[#160E07] to-[#120B05]"
        aria-hidden="true"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
          <span className="text-amber-200/60 text-xs font-outfit uppercase tracking-widest">
            Preparing Invitation...
          </span>
        </div>
      </div>
    ),
  }
)

export default function StorytellingScroll({ onOpenCallback }: StorytellingScrollProps) {
  return <StorytellingScrollInner onOpenCallback={onOpenCallback || (() => {})} />
}
