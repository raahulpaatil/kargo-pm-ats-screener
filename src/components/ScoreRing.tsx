'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { Verdict } from '@/lib/verdict'

const TICKS = 40

// Segmented CRT dial: 40 phosphor ticks that light up to the score.
export function ScoreRing({ score, verdict }: { score: number; verdict: Verdict }) {
  const reduced = useReducedMotion()
  const lit = Math.round((score / 100) * TICKS)

  return (
    <motion.div
      className="relative w-52 h-52"
      initial={reduced ? false : { opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
      role="img"
      aria-label={`Score ${score} out of 100`}
    >
      <svg className="w-52 h-52" viewBox="0 0 160 160" aria-hidden="true">
        {Array.from({ length: TICKS }, (_, i) => {
          const angle = (i / TICKS) * 360 - 90
          const on = i < lit
          return (
            <motion.rect
              key={i}
              x="77"
              y="6"
              width="6"
              height="16"
              rx="1"
              transform={`rotate(${angle + 90} 80 80)`}
              className={on ? verdict.fill : 'fill-line'}
              initial={reduced ? false : { opacity: on ? 0 : 1 }}
              animate={{ opacity: 1 }}
              transition={{ delay: on ? 0.15 + i * 0.018 : 0, duration: 0.05 }}
              style={on ? { filter: 'drop-shadow(0 0 3px currentColor)' } : undefined}
            />
          )
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-6xl font-semibold text-ink text-glow tabular-nums">{score}</span>
        <span className="pixel text-xl text-subtle">/ 100</span>
      </div>
    </motion.div>
  )
}
