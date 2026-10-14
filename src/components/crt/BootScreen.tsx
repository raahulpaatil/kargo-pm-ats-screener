'use client'

import { useEffect, useState } from 'react'
import { LogoMark, Wordmark } from '@/components/crt/Logo'

const SEGMENTS = 22
const SESSION_KEY = 'kargo-booted'

// Maroon CRT boot screen with a segmented loader, shown once per browser
// session. Any key or click skips it; reduced motion skips it entirely.
export function BootScreen() {
  const [phase, setPhase] = useState<'hidden' | 'booting' | 'closing'>('hidden')
  const [filled, setFilled] = useState(0)
  // The loader only starts once the CRT has finished powering on.
  const [powered, setPowered] = useState(false)

  useEffect(() => {
    let booted = false
    try {
      booted = sessionStorage.getItem(SESSION_KEY) === '1'
    } catch {}
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (booted || reduced) return
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {}
    // Mounting the overlay after hydration keeps server and client markup equal.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase('booting')
  }, [])

  useEffect(() => {
    if (phase !== 'booting' || powered) return
    // Fallback in case animationend never fires (e.g. a backgrounded tab).
    const t = setTimeout(() => setPowered(true), 1200)
    return () => clearTimeout(t)
  }, [phase, powered])

  useEffect(() => {
    if (phase !== 'booting' || !powered) return
    if (filled >= SEGMENTS) {
      const t = setTimeout(() => setPhase('closing'), 260)
      return () => clearTimeout(t)
    }
    // Uneven tick lengths read as a real loader rather than a CSS transition.
    const t = setTimeout(() => setFilled((n) => n + 1), 40 + ((filled * 37) % 70))
    return () => clearTimeout(t)
  }, [phase, powered, filled])

  useEffect(() => {
    if (phase !== 'closing') return
    // Never leave the overlay blocking the app if animationend is missed.
    const t = setTimeout(() => setPhase('hidden'), 700)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase === 'hidden') return
    const skip = () => setPhase('closing')
    window.addEventListener('keydown', skip)
    return () => window.removeEventListener('keydown', skip)
  }, [phase])

  if (phase === 'hidden') return null

  return (
    <div
      role="status"
      aria-label="Loading Kargo Resume Screener"
      onClick={() => setPhase('closing')}
      onAnimationEnd={(e) => {
        if (phase === 'closing' && e.target === e.currentTarget) setPhase('hidden')
      }}
      className={`fixed inset-0 z-[70] bg-black flex items-center justify-center p-3 sm:p-6 cursor-pointer ${
        phase === 'closing' ? 'crt-power-off' : ''
      }`}
    >
      <div
        onAnimationEnd={() => setPowered(true)}
        className="crt-power-on relative w-full h-full max-w-5xl max-h-[46rem] rounded-[clamp(18px,4vw,48px)] bg-brand text-brand-ink overflow-hidden flex flex-col items-center justify-center px-6"
        style={{
          boxShadow: 'inset 0 0 120px rgba(0,0,0,0.55), inset 0 0 18px rgba(0,0,0,0.6), 0 0 80px rgba(107,47,42,0.35)',
        }}
      >
        <div className="flex items-center gap-4 sm:gap-6 mb-8">
          <LogoMark className="w-14 h-14 sm:w-24 sm:h-24" />
          <Wordmark className="text-6xl sm:text-8xl text-glow" />
        </div>
        <p className="pixel text-xl sm:text-2xl mb-16 sm:mb-24">Resume Screener, Version 2.0</p>

        <div className="flex gap-[3px] border-2 border-brand-ink/90 p-[3px] w-full max-w-md" aria-hidden="true">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span
              key={i}
              className={`h-6 flex-1 transition-opacity duration-75 ${i < filled ? 'bg-brand-ink' : 'bg-transparent'}`}
            />
          ))}
        </div>

        <p className="pixel text-base sm:text-xl mt-16 sm:mt-24 text-center opacity-90">
          Built for Kargo hiring. PM <span aria-hidden="true">→</span> Senior PM. Press any key.
        </p>
      </div>
    </div>
  )
}
