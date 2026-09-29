import { NextRequest, NextResponse } from 'next/server'
import { getCandidateWithScore, updateCandidateStatus } from '@/lib/candidates'
import type { CandidateStatus } from '@/lib/types'

const VALID_STATUSES: CandidateStatus[] = ['pending', 'accepted', 'rejected']

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const candidate = await getCandidateWithScore(id)
  if (!candidate) {
    return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 })
  }
  return NextResponse.json(candidate)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  const status = body?.status
  if (typeof status !== 'string' || !VALID_STATUSES.includes(status as CandidateStatus)) {
    return NextResponse.json({ error: 'status must be one of pending, accepted, rejected.' }, { status: 400 })
  }
  const ok = await updateCandidateStatus(id, status as CandidateStatus)
  if (!ok) {
    return NextResponse.json({ error: 'Candidate not found.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true, status })
}
