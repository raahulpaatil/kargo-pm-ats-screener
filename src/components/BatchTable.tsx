import Link from 'next/link'
import type { CandidateWithScore } from '@/lib/types'

function Pool({ title, candidates }: { title: string; candidates: CandidateWithScore[] }) {
  return (
    <div className="mb-10">
      <h2 className="text-lg font-semibold text-ink mb-3">{title} ({candidates.length})</h2>
      <div className="bg-surface shadow-soft rounded-xl2 overflow-hidden">
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
              <tr key={c.id} className="border-t border-canvas hover:bg-canvas/50">
                <td className="px-4 py-3 text-subtle">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link href={`/candidate/${c.id}`} className="text-accent font-medium hover:underline">
                    {c.name || 'Unnamed Candidate'}
                  </Link>
                </td>
                <td className="px-4 py-3 font-semibold text-ink">{c.score.total100}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {[c.score.metric1Score, c.score.metric2Score, c.score.metric3Score, c.score.metric4Score, c.score.metric5Score].map((v, idx) => (
                      <span key={idx} className="w-5 h-2 rounded-full bg-canvas relative overflow-hidden block">
                        <span className="absolute inset-y-0 left-0 bg-accent block" style={{ width: `${(v / 4) * 100}%` }} />
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

export function BatchTable({ pm, spm }: { pm: CandidateWithScore[]; spm: CandidateWithScore[] }) {
  return (
    <>
      <Pool title="Product Manager" candidates={pm} />
      <Pool title="Senior Product Manager" candidates={spm} />
    </>
  )
}
