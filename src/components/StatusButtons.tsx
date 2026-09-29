'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CandidateStatus } from '@/lib/types'
import type { Role } from '@/lib/rubric'
import type { Verdict } from '@/lib/verdict'
import { buildDecisionEmail } from '@/lib/email-templates'

type Candidate = {
  id: string
  name: string | null
  email: string | null
  role: Role
}

const STATUS_LABEL: Record<CandidateStatus, string> = {
  pending: 'Awaiting decision',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

// Sticky bottom bar: the decision stays reachable however long the report is.
export function StatusButtons({
  candidate,
  initialStatus,
  verdict,
  nextHref,
}: {
  candidate: Candidate
  initialStatus: CandidateStatus
  verdict: Verdict
  nextHref: string | null
}) {
  const router = useRouter()
  const [status, setStatus] = useState<CandidateStatus>(initialStatus)
  const [pendingDecision, setPendingDecision] = useState<'accepted' | 'rejected' | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => {
      setToast(null)
      if (nextHref) router.replace(nextHref)
    }, 1400)
    return () => clearTimeout(t)
  }, [toast, nextHref, router])

  function openPreview(decision: 'accepted' | 'rejected') {
    setError(null)
    setPendingDecision(decision)
  }

  async function confirmSend() {
    if (!pendingDecision) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/candidates/${candidate.id}/decision`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: pendingDecision }),
      })
      if (res.ok) {
        setStatus(pendingDecision)
        setToast(
          `${pendingDecision === 'accepted' ? 'Acceptance' : 'Rejection'} email sent to ${candidate.email}` +
            (nextHref ? ' · opening next candidate…' : '')
        )
        setPendingDecision(null)
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Something went wrong sending the email.')
      }
    } catch {
      setError('Network error — the email was not sent. Try again.')
    } finally {
      setSending(false)
    }
  }

  const preview = pendingDecision && candidate.email
    ? buildDecisionEmail(candidate.name, candidate.email, candidate.role, pendingDecision)
    : null

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-40 bg-surface/90 backdrop-blur border-t border-line">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="min-w-0 mr-auto flex items-center gap-2 text-sm">
            <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${verdict.soft}`}>
              Suggested: {verdict.label}
            </span>
            <span className="text-subtle truncate hidden sm:inline">{STATUS_LABEL[status]}</span>
          </div>
          <button
            onClick={() => openPreview('rejected')}
            className={`px-5 py-2.5 rounded-lg font-medium transition border ${
              status === 'rejected'
                ? 'bg-danger text-on-solid border-danger'
                : 'border-danger/60 text-danger hover:bg-danger/10'
            }`}
          >
            {status === 'rejected' ? 'Rejected' : 'Reject'}
          </button>
          <button
            onClick={() => openPreview('accepted')}
            className={`px-5 py-2.5 rounded-lg font-medium transition border ${
              status === 'accepted'
                ? 'bg-good text-on-solid border-good'
                : 'bg-good text-on-solid border-good hover:opacity-90'
            }`}
          >
            {status === 'accepted' ? 'Accepted' : 'Accept'}
          </button>
        </div>
      </div>

      {toast && (
        <div role="status" className="fixed bottom-24 inset-x-4 z-50 flex justify-center pointer-events-none">
          <div className="bg-ink text-canvas text-sm font-medium px-4 py-3 rounded-xl shadow-lg">{toast}</div>
        </div>
      )}

      {pendingDecision && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-line rounded-xl2 shadow-soft max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-ink mb-1">
              {pendingDecision === 'accepted' ? 'Send acceptance email?' : 'Send rejection email?'}
            </h2>
            {!candidate.email ? (
              <p className="text-danger text-sm mt-4">
                This candidate has no email on file — an email can&apos;t be sent.
              </p>
            ) : (
              <>
                <p className="text-subtle text-sm mb-4">Review before sending — this sends a real email from your Gmail.</p>
                <div className="bg-canvas rounded-lg p-4 text-sm space-y-1 mb-4">
                  <p><span className="text-subtle">To:</span> {preview?.to}</p>
                  <p><span className="text-subtle">Subject:</span> {preview?.subject}</p>
                  <pre className="whitespace-pre-wrap font-sans text-ink mt-2">{preview?.body}</pre>
                </div>
              </>
            )}
            {error && <p role="alert" className="text-danger text-sm mb-3">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setPendingDecision(null)}
                disabled={sending}
                className="px-4 py-2 rounded-lg font-medium bg-canvas text-ink border border-line hover:border-subtle transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmSend}
                disabled={sending || !candidate.email}
                className="px-4 py-2 rounded-lg font-medium bg-accent text-on-solid hover:opacity-90 transition disabled:opacity-50"
              >
                {sending ? 'Sending…' : error ? 'Retry send' : 'Send & Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
