import { NextRequest, NextResponse } from 'next/server'
import { getCandidateWithScore, updateCandidateStatus } from '@/lib/candidates'
import { buildDecisionEmail } from '@/lib/email-templates'
import { sendDecisionEmail, MailSendError } from '@/lib/mailer'
import type { CandidateStatus } from '@/lib/types'

const SENDABLE_STATUSES: CandidateStatus[] = ['accepted', 'rejected']

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  const status = body?.status

  if (typeof status !== 'string' || !SENDABLE_STATUSES.includes(status as CandidateStatus)) {
    return NextResponse.json({ error: 'status must be accepted or rejected.' }, { status: 400 })
  }

  const candidate = await getCandidateWithScore(id)
  if (!candidate) {
    return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 })
  }
  if (!candidate.email) {
    return NextResponse.json(
      { error: 'This candidate has no email on file — cannot send a decision email.' },
      { status: 400 }
    )
  }

  const email = buildDecisionEmail(candidate.name, candidate.email, candidate.role, status as 'accepted' | 'rejected')

  try {
    await sendDecisionEmail(email)
  } catch (err) {
    if (err instanceof MailSendError) {
      return NextResponse.json({ error: `Failed to send email: ${err.message}` }, { status: 502 })
    }
    throw err
  }

  const ok = await updateCandidateStatus(id, status as CandidateStatus)
  if (!ok) {
    return NextResponse.json(
      { error: 'Email was sent, but updating the candidate status failed.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, status })
}
