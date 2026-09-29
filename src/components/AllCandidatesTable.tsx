'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { CandidateWithScore, CandidateStatus } from '@/lib/types'
import { verdictFor } from '@/lib/verdict'

type RoleFilter = 'ALL' | 'PM' | 'SPM'
type StatusFilter = 'ALL' | CandidateStatus
type SortKey = 'queue' | 'recent' | 'score-desc' | 'score-asc'

const STATUS_STYLES: Record<CandidateStatus, string> = {
  pending: 'bg-accent/15 text-accent',
  accepted: 'bg-good/15 text-good',
  rejected: 'bg-danger/15 text-danger',
}

export function AllCandidatesTable({ candidates }: { candidates: CandidateWithScore[] }) {
  const [role, setRole] = useState<RoleFilter>('ALL')
  const [status, setStatus] = useState<StatusFilter>('ALL')
  const [sort, setSort] = useState<SortKey>('queue')

  const filtered = useMemo(() => {
    let list = candidates
    if (role !== 'ALL') list = list.filter((c) => c.role === role)
    if (status !== 'ALL') list = list.filter((c) => c.status === status)

    const sorted = [...list]
    if (sort === 'queue') {
      // Needs review first, then best score — same order as candidate prev/next.
      sorted.sort(
        (a, b) =>
          Number(b.status === 'pending') - Number(a.status === 'pending') ||
          b.score.total100 - a.score.total100 ||
          Date.parse(b.createdAt) - Date.parse(a.createdAt)
      )
    } else if (sort === 'score-desc') sorted.sort((a, b) => b.score.total100 - a.score.total100)
    else if (sort === 'score-asc') sorted.sort((a, b) => a.score.total100 - b.score.total100)
    return sorted
  }, [candidates, role, status, sort])

  function toggleScoreSort() {
    setSort((prev) => (prev === 'score-desc' ? 'score-asc' : 'score-desc'))
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as RoleFilter)}
          className="bg-surface text-ink border border-line rounded-lg px-3 py-2 text-sm"
        >
          <option value="ALL">All roles</option>
          <option value="PM">Product Manager</option>
          <option value="SPM">Senior Product Manager</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className="bg-surface text-ink border border-line rounded-lg px-3 py-2 text-sm"
        >
          <option value="ALL">All statuses</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
        <span className="text-subtle text-sm self-center">{filtered.length} candidate{filtered.length === 1 ? '' : 's'}</span>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface shadow-soft border border-line rounded-xl2 p-10 text-center">
          <p className="text-ink font-medium mb-1">
            {candidates.length === 0 ? 'No candidates yet' : 'Nothing matches these filters'}
          </p>
          <p className="text-subtle text-sm mb-4">
            {candidates.length === 0 ? 'Upload a few resumes to start screening.' : 'Try widening the role or status filter.'}
          </p>
          {candidates.length === 0 && (
            <Link href="/" className="text-accent text-sm font-medium hover:underline">Score resumes →</Link>
          )}
        </div>
      ) : (
        <div className="bg-surface shadow-soft border border-line rounded-xl2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-subtle text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">
                  <button onClick={toggleScoreSort} className="font-medium hover:text-ink transition">
                    Score {sort === 'score-desc' ? '↓' : sort === 'score-asc' ? '↑' : ''}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Flags</th>
                <th className="px-4 py-3 font-medium">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-t border-line hover:bg-canvas/60">
                  <td className="px-4 py-3">
                    <Link href={`/candidate/${c.id}`} className="text-accent font-medium hover:underline">
                      {c.name || 'Unnamed Candidate'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-subtle">{c.role === 'PM' ? 'Product Manager' : 'Senior Product Manager'}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-ink mr-2">{c.score.total100}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${verdictFor(c.score.total100, c.score.flagHiddenFit).soft}`}>
                      {verdictFor(c.score.total100, c.score.flagHiddenFit).label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${STATUS_STYLES[c.status]}`}>
                      {c.status === 'pending' ? 'Needs review' : c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.score.flagHiddenFit && <span className="text-good text-xs font-medium mr-2">Hidden Fit</span>}
                    {c.score.flagSpecShallow && <span className="text-warn text-xs font-medium">Spec-Shallow</span>}
                  </td>
                  <td className="px-4 py-3 text-subtle">
                    {new Date(c.createdAt).toLocaleDateString('en-US')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
