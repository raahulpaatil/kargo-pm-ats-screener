import { describe, it, expect, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { GET, PATCH } from '@/app/api/candidates/[id]/route'

describe('/api/candidates/[id]', () => {
  let candidateId: string

  async function seed() {
    const [c] = await sql`
      insert into candidates (role, name, file_url, file_name, resume_text)
      values ('PM', 'Sam Lee', 'https://x/f.pdf', 'f.pdf', 'text')
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

  afterEach(async () => {
    if (candidateId) await sql`delete from candidates where id = ${candidateId}`
  })

  it('GET returns 404 for a missing candidate', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/candidates/x'), {
      params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }),
    })
    expect(res.status).toBe(404)
  })

  it('GET returns 404 for a malformed id instead of a 500', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/candidates/not-a-uuid'), {
      params: Promise.resolve({ id: 'not-a-uuid' }),
    })
    expect(res.status).toBe(404)
  })

  it('GET returns the candidate with score', async () => {
    candidateId = await seed()
    const res = await GET(new NextRequest('http://localhost:3000/api/candidates/x'), {
      params: Promise.resolve({ id: candidateId }),
    })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.name).toBe('Sam Lee')
  })

  it('PATCH rejects an invalid status', async () => {
    candidateId = await seed()
    const req = new NextRequest('http://localhost:3000/api/candidates/x', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'maybe' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: candidateId }) })
    expect(res.status).toBe(400)
  })

  it('PATCH updates status to accepted', async () => {
    candidateId = await seed()
    const req = new NextRequest('http://localhost:3000/api/candidates/x', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: candidateId }) })
    expect(res.status).toBe(200)
  })

  it('PATCH returns 404 for a malformed id instead of a 500', async () => {
    const req = new NextRequest('http://localhost:3000/api/candidates/not-a-uuid', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: 'not-a-uuid' }) })
    expect(res.status).toBe(404)
  })
})
