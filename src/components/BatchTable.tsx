import Link from 'next/link'
import type { CandidateWithScore } from '@/lib/types'
import { verdictFor, metricColor } from '@/lib/verdict'

function Pool({ title, candidates, batchId }: { title: string; candidates: CandidateWithScore[]; batchId: string }) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-semibold text-ink mb-3">{title} ({candidates.length})</h2>
      <div className="bg-surface shadow-soft border border-line rounded-xl2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-subtle text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Rank</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Metrics</th>
              <th className="px-4 py-3 font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c, i) => (
              <tr key={c.id} className="border-t border-line hover:bg-canvas/60">
                <td className="px-4 py-3 text-subtle">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link href={`/candidate/${c.id}?batch=${batchId}`} className="text-accent font-medium hover:underline">
                    {c.name || 'Unnamed Candidate'}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="font-semibold text-ink mr-2">{c.score.total100}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${verdictFor(c.score.total100, c.score.flagHiddenFit).soft}`}>
                    {verdictFor(c.score.total100, c.score.flagHiddenFit).label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {[c.score.metric1Score, c.score.metric2Score, c.score.metric3Score, c.score.metric4Score, c.score.metric5Score].map((v, idx) => (
                      <span key={idx} className="w-5 h-2 rounded-full bg-line relative overflow-hidden block">
                        <span className={`absolute inset-y-0 left-0 block ${metricColor(v).pip}`} style={{ width: `${(v / 4) * 100}%` }} />
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {c.score.flagHiddenFit && <span className="text-good text-xs font-medium mr-2">Hidden Fit</span>}
                  {c.score.flagSpecShallow && <span className="text-warn text-xs font-medium">Spec-Shallow</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function BatchTable({ pm, spm, batchId }: { pm: CandidateWithScore[]; spm: CandidateWithScore[]; batchId: string }) {
  return (
    <>
      <Pool title="Product Manager" candidates={pm} batchId={batchId} />
      <Pool title="Senior Product Manager" candidates={spm} batchId={batchId} />
    </>
  )
}
