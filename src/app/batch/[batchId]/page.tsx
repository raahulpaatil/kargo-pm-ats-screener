import { getBatchCandidates } from '@/lib/candidates'
import { verdictFor } from '@/lib/verdict'
import { BatchTable } from '@/components/BatchTable'
import { TopBar } from '@/components/TopBar'
import { BatchReel } from '@/components/BatchReel'
import type { FilmFrame } from '@/components/scene/Filmstrip'

export default async function BatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params
  const { pm, spm } = await getBatchCandidates(batchId)

  // Best matches first across both pools, as frames on the reel.
  const frames: FilmFrame[] = [...pm, ...spm]
    .sort((a, b) => b.score.total100 - a.score.total100)
    .slice(0, 10)
    .map((c) => ({
      id: c.id,
      name: c.name || 'Unnamed Candidate',
      score: c.score.total100,
      verdict: verdictFor(c.score.total100, c.score.flagHiddenFit).label,
      role: c.role,
      href: `/candidate/${c.id}?batch=${batchId}`,
    }))

  return (
    <main id="main" className="min-h-svh px-5 sm:px-8 py-6 sm:py-8 max-w-6xl mx-auto w-full">
      <TopBar title="Batch Results" subtitle={`${pm.length + spm.length} resumes scored — best matches first`} />
      <BatchReel frames={frames} />
      <BatchTable pm={pm} spm={spm} batchId={batchId} />
    </main>
  )
}
