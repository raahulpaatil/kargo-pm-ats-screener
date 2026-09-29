import { notFound } from 'next/navigation'
import { getCandidateWithScore } from '@/lib/candidates'
import { ScoreRing } from '@/components/ScoreRing'
import { MetricBreakdown } from '@/components/MetricBreakdown'
import { StatusButtons } from '@/components/StatusButtons'

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const candidate = await getCandidateWithScore(id)
  if (!candidate) notFound()

  return (
    <main className="min-h-screen bg-canvas p-8 max-w-3xl mx-auto">
      <div className="bg-surface shadow-soft rounded-xl2 p-8 mb-6 flex flex-col items-center">
        <h1 className="text-2xl font-semibold text-ink mb-1">{candidate.name || 'Unnamed Candidate'}</h1>
        <p className="text-subtle mb-6">{candidate.role === 'PM' ? 'Product Manager' : 'Senior Product Manager'}</p>
        <ScoreRing score={candidate.score.total100} />
        <div className="mt-6">
          <StatusButtons candidateId={candidate.id} initialStatus={candidate.status} />
        </div>
        {(candidate.score.flagHiddenFit || candidate.score.flagSpecShallow) && (
          <div className="mt-6 flex gap-2">
            {candidate.score.flagHiddenFit && (
              <span className="bg-good/10 text-good text-xs font-medium px-3 py-1 rounded-full">Hidden Fit</span>
            )}
            {candidate.score.flagSpecShallow && (
              <span className="bg-warn/10 text-warn text-xs font-medium px-3 py-1 rounded-full">Spec-Matched but Shallow</span>
            )}
          </div>
        )}
      </div>
      <MetricBreakdown score={candidate.score} />
    </main>
  )
}
