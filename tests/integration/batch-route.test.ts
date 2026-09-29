import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { GET } from '@/app/api/batch/[batchId]/route'

describe('GET /api/batch/[batchId]', () => {
  it('returns empty pm/spm arrays for an unknown batch', async () => {
    const res = await GET(new NextRequest('http://localhost:3000/api/batch/x'), {
      params: Promise.resolve({ batchId: crypto.randomUUID() }),
    })
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json).toEqual({ pm: [], spm: [] })
  })

  it('returns seeded candidates grouped by role', async () => {
    const batchId = crypto.randomUUID()
    const [c] = await sql`
      insert into candidates (role, name, file_url, file_name, resume_text, batch_id)
      values ('PM', 'Test Candidate', 'https://x/f.pdf', 'f.pdf', 'text', ${batchId})
      returning id
    `
    await sql`
      insert into scores (
        candidate_id, metric_1_score, metric_1_rationale, metric_2_score, metric_2_rationale,
        metric_3_score, metric_3_rationale, metric_4_score, metric_4_rationale,
        metric_5_score, metric_5_rationale, total_raw, total_100, flag_hidden_fit, flag_spec_shallow
      ) values (${c.id}, 2,'a',2,'b',2,'c',2,'d',2,'e',10,50,false,false)
    `
    const res = await GET(new NextRequest('http://localhost:3000/api/batch/x'), {
      params: Promise.resolve({ batchId }),
    })
    const json = await res.json()
    expect(json.pm).toHaveLength(1)
    expect(json.spm).toHaveLength(0)

    await sql`delete from candidates where id = ${c.id}`
  })
})
