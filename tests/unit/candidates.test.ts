import { describe, it, expect, afterEach } from 'vitest'
import { sql } from '@/lib/db'
import { getCandidateWithScore, updateCandidateStatus } from '@/lib/candidates'

describe('candidates lib', () => {
  let candidateId: string

  async function seed() {
    const [c] = await sql`
      insert into candidates (role, name, email, file_url, file_name, resume_text)
      values ('SPM', 'Alex Kim', 'alex@example.com', 'https://x/f.pdf', 'f.pdf', 'text')
      returning id
    `
    await sql`
      insert into scores (
        candidate_id, metric_1_score, metric_1_rationale, metric_2_score, metric_2_rationale,
        metric_3_score, metric_3_rationale, metric_4_score, metric_4_rationale,
        metric_5_score, metric_5_rationale, total_raw, total_100, flag_hidden_fit, flag_spec_shallow
      ) values (${c.id}, 4,'a',4,'b',4,'c',3,'d',2,'e',17,85,true,false)
    `
    return c.id as string
  }

  afterEach(async () => {
    if (candidateId) await sql`delete from candidates where id = ${candidateId}`
  })

  it('getCandidateWithScore returns the joined row', async () => {
    candidateId = await seed()
    const result = await getCandidateWithScore(candidateId)
    expect(result?.name).toBe('Alex Kim')
    expect(result?.score.total100).toBe(85)
    expect(result?.score.flagHiddenFit).toBe(true)
  })

  it('getCandidateWithScore returns null for a missing id', async () => {
    const result = await getCandidateWithScore('00000000-0000-0000-0000-000000000000')
    expect(result).toBeNull()
  })

  it('getCandidateWithScore returns null for a malformed id instead of throwing', async () => {
    const result = await getCandidateWithScore('not-a-uuid')
    expect(result).toBeNull()
  })

  it('updateCandidateStatus updates and returns true', async () => {
    candidateId = await seed()
    const ok = await updateCandidateStatus(candidateId, 'accepted')
    expect(ok).toBe(true)
    const result = await getCandidateWithScore(candidateId)
    expect(result?.status).toBe('accepted')
  })

  it('updateCandidateStatus returns false for a missing id', async () => {
    const ok = await updateCandidateStatus('00000000-0000-0000-0000-000000000000', 'accepted')
    expect(ok).toBe(false)
  })

  it('updateCandidateStatus returns false for a malformed id instead of throwing', async () => {
    const ok = await updateCandidateStatus('not-a-uuid', 'accepted')
    expect(ok).toBe(false)
  })
})
