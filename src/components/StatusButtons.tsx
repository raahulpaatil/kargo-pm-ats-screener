'use client'

import { useState } from 'react'
import type { CandidateStatus } from '@/lib/types'
import type { Role } from '@/lib/rubric'
import { buildDecisionEmail } from '@/lib/email-templates'

type Candidate = {
  id: string
  name: string | null
  email: string | null
  role: Role
}

export function StatusButtons({ candidate, initialStatus }: { candidate: Candidate; initialStatus: CandidateStatus }) {
  const [status, setStatus] = useState<CandidateStatus>(initialStatus)
  const [pendingDecision, setPendingDecision] = useState<'accepted' | 'rejected' | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openPreview(decision: 'accepted' | 'rejected') {
    setError(null)
    setPendingDecision(decision)
  }

  async function confirmSend() {
    if (!pendingDecision) return
    setSending(true)
    setError(null)
    const res = await fetch(`/api/candidates/${candidate.id}/decision`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: pendingDecision }),
    })
    setSending(false)
    if (res.ok) {
      setStatus(pendingDecision)
      setPendingDecision(null)
    } else {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'Something went wrong sending the email.')
    }
  }

  const preview = pendingDecision && candidate.email
    ? buildDecisionEmail(candidate.name, candidate.email, candidate.role, pendingDecision)
    : null

  return (
    <div>
      <div className="flex gap-3">
        <button
          onClick={() => openPreview('accepted')}
          className={`px-5 py-2 rounded-lg font-medium transition ${status === 'accepted' ? 'bg-good text-white' : 'bg-canvas text-ink hover:bg-good/10'}`}
        >
          Accept
        </button>
        <button
          onClick={() => openPreview('rejected')}
          className={`px-5 py-2 rounded-lg font-medium transition ${status === 'rejected' ? 'bg-danger text-white' : 'bg-canvas text-ink hover:bg-danger/10'}`}
        >
          Reject
        </button>
      </div>

      {pendingDecision && (
        <div className="fixed inset-0 bg-ink/40 flex items-center justify-center p-4 z-50">
          <div className="bg-surface rounded-xl2 shadow-soft max-w-lg w-full p-6">
            <h2 className="text-lg font-semibold text-ink mb-1">
              {pendingDecision === 'accepted' ? 'Send acceptance email?' : 'Send rejection email?'}
            </h2>
            {!candidate.email ? (
              <p className="text-danger text-sm mt-4">
                This candidate has no email on file — an email can&apos;t be sent. You can still cancel and mark
                status manually once email support is added for candidates without one.
              </p>
            ) : (
              <>
                <p className="text-subtle text-sm mb-4">Review before sending — this will send a real email.</p>
                <div className="bg-canvas rounded-lg p-4 text-sm space-y-1 mb-4">
                  <p><span className="text-subtle">To:</span> {preview?.to}</p>
                  <p><span className="text-subtle">Subject:</span> {preview?.subject}</p>
                  <pre className="whitespace-pre-wrap font-sans text-ink mt-2">{preview?.body}</pre>
                </div>
              </>
            )}
            {error && <p className="text-danger text-sm mb-3">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setPendingDecision(null)}
                disabled={sending}
                className="px-4 py-2 rounded-lg font-medium bg-canvas text-ink hover:bg-canvas/70 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmSend}
                disabled={sending || !candidate.email}
                className="px-4 py-2 rounded-lg font-medium bg-accent text-white hover:opacity-90 transition disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send & Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
