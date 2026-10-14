'use client'

import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, Noise, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Filmstrip, type FilmFrame } from '@/components/scene/Filmstrip'
import { useReducedMotion, useTheme } from '@/lib/theme'

// Self-contained reel for pages other than home (e.g. batch results), with
// keyboard-reachable prev/next controls and a link to the front frame.
export function FilmstripStage({ frames, label }: { frames: FilmFrame[]; label: string }) {
  const [index, setIndex] = useState(0)
  const router = useRouter()
  const reduced = useReducedMotion()
  const light = useTheme() === 'light'
  const current = frames[index]
  if (!current) return null

  const step = (dir: 1 | -1) => setIndex((i) => (i + dir + frames.length) % frames.length)

  return (
    <section aria-label={label} className="mb-10">
      <div className="h-[clamp(16rem,38vw,24rem)] -mx-5 sm:-mx-8" aria-hidden="true">
        <Canvas dpr={[1, 1.5]} camera={{ fov: 36, position: [0, 0.1, 4.3] }} gl={{ antialias: false, alpha: true }}>
          <ambientLight intensity={light ? 1.1 : 0.35} />
          <pointLight position={[0, 2.5, 3]} intensity={light ? 10 : 22} color="#ffd9b0" distance={10} />
          <pointLight position={[-3, -1, -2]} intensity={6} color="#7d5a8c" />
          <Filmstrip
            frames={frames}
            index={index}
            autoSpin={!reduced}
            onPick={(i) => (i === index ? router.push(frames[i].href) : setIndex(i))}
          />
          <EffectComposer multisampling={0}>
            <Bloom mipmapBlur intensity={light ? 0.3 : 0.7} luminanceThreshold={0.6} />
            <Noise premultiply blendFunction={BlendFunction.SCREEN} opacity={0.1} />
            <Vignette offset={0.3} darkness={light ? 0.2 : 0.6} />
          </EffectComposer>
        </Canvas>
      </div>
      <div className="flex items-center justify-center gap-4 mt-2">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous candidate on the reel"
          className="w-11 h-11 rounded-md border border-line bg-surface/70 text-ink hover:border-accent transition-colors cursor-pointer text-2xl"
        >
          ‹
        </button>
        <Link
          href={current.href}
          aria-live="polite"
          className="min-w-0 max-w-[60vw] text-center px-4 py-2 rounded-md bg-surface/70 border border-line hover:border-accent transition-colors"
        >
          <span className="block text-xl text-ink truncate">
            #{index + 1} {current.name}
          </span>
          <span className="pixel text-lg text-subtle">
            {current.score}/100 · {current.verdict} · open report
          </span>
        </Link>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next candidate on the reel"
          className="w-11 h-11 rounded-md border border-line bg-surface/70 text-ink hover:border-accent transition-colors cursor-pointer text-2xl"
        >
          ›
        </button>
      </div>
    </section>
  )
}
