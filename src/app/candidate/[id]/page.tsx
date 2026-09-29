import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCandidateWithScore, getReviewQueue } from '@/lib/candidates'
import { verdictFor } from '@/lib/verdict'
import { ScoreRing } from '@/components/ScoreRing'
import { MetricBreakdown } from '@/components/MetricBreakdown'
import { StatusButtons } from '@/components/StatusButtons'
import { TopBar } from '@/components/TopBar'

function NavArrow({ href, label, children }: { href: string | null; label: string; children: string }) {
  const cls = 'w-9 h-9 rounded-full border border-line flex items-center justify-center text-lg'
  return href ? (
    <Link href={href} replace aria-label={label} className={`${cls} text-subtle hover:text-ink transition`}>
      {children}
    </Link>
  ) : (
    <span aria-hidden="true" className={`${cls} text-line`}>{children}</span>
  )
}

export default async function CandidatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ batch?: string }>
}) {
  const { id } = await params
  const { batch } = await searchParams
  const candidate = await getCandidateWithScore(id)
  if (!candidate) notFound()

  const queue = await getReviewQueue(batch)
  const index = queue.findIndex((q) => q.id === id)
  const qs = batch ? `?batch=${encodeURIComponent(batch)}` : ''
  const hrefFor = (i: number) => (i >= 0 && i < queue.length ? `/candidate/${queue[i].id}${qs}` : null)
  const nextPending = index >= 0 ? queue.findIndex((q, i) => i > index && q.status === 'pending') : -1

  const { score } = candidate
  const verdict = verdictFor(score.total100, score.flagHiddenFit)

  return (
    <main className="min-h-screen bg-canvas px-4 pt-6 pb-32 max-w-3xl mx-auto w-full">
      <TopBar>
        {index >= 0 && (
          <div className="flex items-center gap-2 mr-2">
            <NavArrow href={hrefFor(index - 1)} label="Previous candidate">‹</NavArrow>
            <span className="text-subtle text-sm tabular-nums">{index + 1} of {queue.length}</span>
            <NavArrow href={hrefFor(index + 1)} label="Next candidate">›</NavArrow>
          </div>
        )}
      </TopBar>

      <div className="bg-surface shadow-soft border border-line rounded-xl2 p-8 mb-6 flex flex-col items-center">
        <h1 className="text-2xl font-semibold text-ink mb-1 text-center">{candidate.name || 'Unnamed Candidate'}</h1>
        <p className="text-subtle mb-6">{candidate.role === 'PM' ? 'Product Manager' : 'Senior Product Manager'}</p>
        <ScoreRing score={score.total100} verdict={verdict} />
        <span className={`mt-5 text-sm font-semibold px-3 py-1 rounded-full ${verdict.soft}`}>{verdict.label}</span>
        {(score.flagHiddenFit || score.flagSpecShallow) && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {score.flagHiddenFit && (
              <span className="bg-good/15 text-good text-xs font-medium px-3 py-1 rounded-full">Hidden Fit</span>
            )}
            {score.flagSpecShallow && (
              <span className="bg-warn/15 text-warn text-xs font-medium px-3 py-1 rounded-full">Spec-Matched but Shallow</span>
            )}
          </div>
        )}
      </div>
      <MetricBreakdown score={score} />

      <StatusButtons
        candidate={{ id: candidate.id, name: candidate.name, email: candidate.email, role: candidate.role }}
        initialStatus={candidate.status}
        verdict={verdict}
        nextHref={hrefFor(nextPending)}
      />
    </main>
  )
}
