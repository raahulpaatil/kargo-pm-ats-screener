'use client'

import { useState } from 'react'
import type { CandidateStatus } from '@/lib/types'

export function StatusButtons({ candidateId, initialStatus }: { candidateId: string; initialStatus: CandidateStatus }) {
  const [status, setStatus] = useState<CandidateStatus>(initialStatus)
  const [pending, setPending] = useState(false)

  async function updateStatus(next: CandidateStatus) {
    setPending(true)
    const res = await fetch(`/api/candidates/${candidateId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setPending(false)
    if (res.ok) setStatus(next)
  }

  return (
    <div className="flex gap-3">
      <button
        onClick={() => updateStatus('accepted')}
        disabled={pending}
        className={`px-5 py-2 rounded-lg font-medium transition ${status === 'accepted' ? 'bg-good text-white' : 'bg-canvas text-ink hover:bg-good/10'}`}
      >
        Accept
      </button>
      <button
        onClick={() => updateStatus('rejected')}
        disabled={pending}
        className={`px-5 py-2 rounded-lg font-medium transition ${status === 'rejected' ? 'bg-danger text-white' : 'bg-canvas text-ink hover:bg-danger/10'}`}
      >
        Reject
      </button>
    </div>
  )
}
