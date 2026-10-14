'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UploadForm } from '@/components/UploadForm'
import { TopBar, PromptLink } from '@/components/TopBar'
import type { FilmFrame } from '@/components/scene/Filmstrip'

// WebGL only runs in the browser; the DOM below is fully usable without it.
const HomeScene = dynamic(() => import('@/components/scene/HomeScene').then((m) => m.HomeScene), {
  ssr: false,
  loading: () => null,
})

function PixelPointer({ delay }: { delay: string }) {
  return (
    <svg viewBox="0 0 16 16" className="w-7 h-7 animate-bounce motion-reduce:animate-none" style={{ animationDelay: delay }} aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 1h2v7h1V6h2v2h1V7h2v6h-1v2H5v-2H4v-2H3V8h2v2h1z"
        shapeRendering="crispEdges"
        transform="rotate(180 8 8)"
      />
    </svg>
  )
}

export function HomeExperience({ frames }: { frames: FilmFrame[] }) {
  const [frameIndex, setFrameIndex] = useState(0)
  const router = useRouter()
  const current = frames[frameIndex]

  function step(dir: 1 | -1) {
    if (frames.length === 0) return
    setFrameIndex((i) => (i + dir + frames.length) % frames.length)
  }

  function pick(i: number) {
    // First click turns the reel to that frame; clicking the front frame opens it.
    if (i === frameIndex) router.push(frames[i].href)
    else setFrameIndex(i)
  }

  return (
    <>
      <div className="fixed inset-0 z-0">
        <HomeScene frames={frames} frameIndex={frameIndex} onPickFrame={pick} />
      </div>

      <main id="main" className="relative z-10 pointer-events-none">
        {/* 1 — Hero */}
        <section data-scene-stop className="min-h-svh flex flex-col px-5 sm:px-8 pt-5 sm:pt-7">
          <div className="pointer-events-auto max-w-6xl mx-auto w-full">
            <TopBar close={false}>
              <PromptLink href="/candidates">All candidates</PromptLink>
            </TopBar>
          </div>
          <div className="text-center mt-[4vh] sm:mt-[2vh]">
            <h1 className="text-[clamp(2.2rem,7vw,5.2rem)] leading-[1.05] font-semibold text-ink text-glow text-balance">
              <span className="sm:block">Hi, I&apos;m the screener. </span>
              <span className="sm:block">I read every resume </span>
              <span className="sm:block">so you don&apos;t have to.</span>
            </h1>
            <p className="text-lg sm:text-xl text-ink/90 mt-5">
              Five-metric rubric. Scored by Gemini. Ranked for Kargo.
            </p>
            <a
              href="#upload"
              className="pointer-events-auto inline-flex items-center gap-4 mt-6 text-ink/90 hover:text-accent transition-colors p-2"
            >
              <span className="sr-only">Scroll to upload</span>
              <PixelPointer delay="0s" />
              <PixelPointer delay="0.15s" />
              <PixelPointer delay="0.3s" />
            </a>
          </div>
        </section>

        {/* 2 — Upload: the camera swings to a three-quarter view of the terminal */}
        <section
          id="upload"
          data-scene-stop
          className="min-h-svh flex items-end md:items-center px-5 sm:px-8 pt-[48svh] md:pt-0 pb-10 scroll-mt-0"
        >
          <div className="pointer-events-auto w-full max-w-6xl mx-auto flex md:justify-end">
            <div className="w-full md:w-[min(34rem,50%)] bg-surface/80 backdrop-blur-md border border-line rounded-xl2 shadow-soft p-6 sm:p-8">
              <p className="pixel text-xl text-accent mb-1">STEP 01 / LOAD THE TAPE</p>
              <h2 className="text-3xl sm:text-4xl font-semibold text-ink text-glow mb-2">Score candidates</h2>
              <p className="text-subtle mb-6">
                Pick the role, drop one resume or a whole batch. Watch the terminal while it works.
              </p>
              <UploadForm />
            </div>
          </div>
        </section>

        {/* 3 — Recently screened: the camera rises to the film reel */}
        <section data-scene-stop className="min-h-svh flex flex-col justify-between px-5 sm:px-8 py-10">
          <div className="text-center">
            <p className="pixel text-xl text-accent mb-1">STEP 02 / REVIEW THE REEL</p>
            <h2 className="text-4xl sm:text-5xl font-semibold text-ink text-glow">Recently screened</h2>
          </div>

          <div className="pointer-events-auto text-center">
            {current ? (
              <>
                <div className="flex items-center justify-center gap-4 mb-3">
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
                    className="min-w-0 max-w-[60vw] px-4 py-2 rounded-md bg-surface/70 border border-line hover:border-accent transition-colors"
                  >
                    <span className="block text-xl text-ink truncate">{current.name}</span>
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
                <PromptLink href="/candidates">View all candidates</PromptLink>
              </>
            ) : (
              <p className="text-subtle">
                Nothing on the reel yet. <a href="#upload" className="text-accent hover:underline">Score your first resume.</a>
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  )
}
