'use client'

import { motion } from 'framer-motion'
import type { Verdict } from '@/lib/verdict'

export function ScoreRing({ score, verdict }: { score: number; verdict: Verdict }) {
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <motion.div
      className="relative w-48 h-48"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <svg className="w-48 h-48 -rotate-90" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={radius} strokeWidth="12" className="stroke-line" fill="none" />
        <circle
          cx="80" cy="80" r={radius} strokeWidth="12" fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className={`${verdict.stroke} transition-all duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-semibold text-ink">{score}</span>
        <span className="text-subtle text-sm">/ 100</span>
      </div>
    </motion.div>
  )
}
