'use client'

import dynamic from 'next/dynamic'
import type { FilmFrame } from '@/components/scene/Filmstrip'

const FilmstripStage = dynamic(() => import('@/components/scene/FilmstripStage').then((m) => m.FilmstripStage), {
  ssr: false,
  loading: () => <div className="h-[clamp(16rem,38vw,24rem)] mb-10" aria-hidden="true" />,
})

export function BatchReel({ frames }: { frames: FilmFrame[] }) {
  if (frames.length === 0) return null
  return <FilmstripStage frames={frames} label="Top candidates in this batch" />
}
