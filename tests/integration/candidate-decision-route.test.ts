import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { ResendSendError } from '@/lib/resend'

vi.mock('@/lib/resend', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/resend')>()
  return { ...actual, sendDecisionEmail: vi.fn() }
})

import { sendDecisionEmail } from '@/lib/resend'
import { POST } from '@/app/api/candidates/[id]/decision/route'

const mockedSend = vi.mocked(sendDecisionEmail)

async function seedCandidate(email: string | null) {
  const [c] = await sql`
    insert into candidates (role, name, email, file_url, file_name, resume_text)
    values ('PM', 'Jane Doe', ${email}, 'https://x/f.pdf', 'f.pdf', 'text')
    returning id
  `
  await sql`
    insert into scores (
      candidate_id, metric_1_score, metric_1_rationale, metric_2_score, metric_2_rationale,
      metric_3_score, metric_3_rationale, metric_4_score, metric_4_rationale,
      metric_5_score, metric_5_rationale, total_raw, total_100, flag_hidden_fit, flag_spec_shallow
    ) values (${c.id}, 2,'a',2,'b',2,'c',2,'d',2,'e',10,50,false,false)
  `
  return c.id as string
}

function makeRequest(status: unknown) {
  return new NextRequest('http://localhost:3000/api/candidates/x/decision', {
    method: 'POST',
    body: JSON.stringify({ status }),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/candidates/[id]/decision', () => {
  let candidateId: string

  afterEach(async () => {
    vi.restoreAllMocks()
    if (candidateId) await sql`delete from candidates where id = ${candidateId}`
  })

  it('rejects an invalid status', async () => {
    candidateId = await seedCandidate('jane@example.com')
    const res = await POST(makeRequest('maybe'), { params: Promise.resolve({ id: candidateId }) })
    expect(res.status).toBe(400)
    expect(mockedSend).not.toHaveBeenCalled()
  })

  it('returns 404 for a missing candidate', async () => {
    const res = await POST(makeRequest('accepted'), {
      params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }),
    })
    expect(res.status).toBe(404)
  })

  it('returns 400 without sending when the candidate has no email on file', async () => {
    candidateId = await seedCandidate(null)
    const res = await POST(makeRequest('accepted'), { params: Promise.resolve({ id: candidateId }) })
    expect(res.status).toBe(400)
    expect(mockedSend).not.toHaveBeenCalled()
  })

  it('returns 502 and does not update status when the email fails to send', async () => {
    candidateId = await seedCandidate('jane@example.com')
    mockedSend.mockRejectedValue(new ResendSendError('Invalid from address'))
    const res = await POST(makeRequest('accepted'), { params: Promise.resolve({ id: candidateId }) })
    expect(res.status).toBe(502)

    const [row] = await sql`select status from candidates where id = ${candidateId}`
    expect(row.status).toBe('pending')
  })

  it('sends the email and updates status on success', async () => {
    candidateId = await seedCandidate('jane@example.com')
    mockedSend.mockResolvedValue({ id: 'msg_123' })
    const res = await POST(makeRequest('accepted'), { params: Promise.resolve({ id: candidateId }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.status).toBe('accepted')
    expect(mockedSend).toHaveBeenCalledTimes(1)
    const [sentEmail] = mockedSend.mock.calls[0]
    expect(sentEmail.to).toBe('jane@example.com')

    const [row] = await sql`select status from candidates where id = ${candidateId}`
    expect(row.status).toBe('accepted')
  })
})
