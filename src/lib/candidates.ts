import { sql } from '@/lib/db'
import type { CandidateWithScore, CandidateStatus } from '@/lib/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuid(id: string): boolean {
  return UUID_RE.test(id)
}

function mapRow(row: Record<string, unknown>): CandidateWithScore {
  return {
    id: row.id as string,
    role: row.role as CandidateWithScore['role'],
    name: row.name as string | null,
    email: row.email as string | null,
    status: row.status as CandidateStatus,
    fileUrl: row.file_url as string,
    fileName: row.file_name as string,
    batchId: row.batch_id as string | null,
    createdAt: row.created_at as string,
    score: {
      metric1Score: row.metric_1_score as number, metric1Rationale: row.metric_1_rationale as string,
      metric2Score: row.metric_2_score as number, metric2Rationale: row.metric_2_rationale as string,
      metric3Score: row.metric_3_score as number, metric3Rationale: row.metric_3_rationale as string,
      metric4Score: row.metric_4_score as number, metric4Rationale: row.metric_4_rationale as string,
      metric5Score: row.metric_5_score as number, metric5Rationale: row.metric_5_rationale as string,
      totalRaw: row.total_raw as number,
      total100: row.total_100 as number,
      flagHiddenFit: row.flag_hidden_fit as boolean,
      flagSpecShallow: row.flag_spec_shallow as boolean,
    },
  }
}

export async function getCandidateWithScore(id: string): Promise<CandidateWithScore | null> {
  if (!isUuid(id)) return null
  const rows = await sql`
    select c.*, s.metric_1_score, s.metric_1_rationale, s.metric_2_score, s.metric_2_rationale,
           s.metric_3_score, s.metric_3_rationale, s.metric_4_score, s.metric_4_rationale,
           s.metric_5_score, s.metric_5_rationale, s.total_raw, s.total_100,
           s.flag_hidden_fit, s.flag_spec_shallow
    from candidates c
    join scores s on s.candidate_id = c.id
    where c.id = ${id}
  `
  return rows.length > 0 ? mapRow(rows[0]) : null
}

export async function updateCandidateStatus(id: string, status: CandidateStatus): Promise<boolean> {
  if (!isUuid(id)) return false
  const rows = await sql`update candidates set status = ${status} where id = ${id} returning id`
  return rows.length > 0
}

export async function getAllCandidates(): Promise<CandidateWithScore[]> {
  const rows = await sql`
    select c.*, s.metric_1_score, s.metric_1_rationale, s.metric_2_score, s.metric_2_rationale,
           s.metric_3_score, s.metric_3_rationale, s.metric_4_score, s.metric_4_rationale,
           s.metric_5_score, s.metric_5_rationale, s.total_raw, s.total_100,
           s.flag_hidden_fit, s.flag_spec_shallow
    from candidates c
    join scores s on s.candidate_id = c.id
    order by c.created_at desc
  `
  return rows.map(mapRow)
}

export async function getBatchCandidates(
  batchId: string
): Promise<{ pm: CandidateWithScore[]; spm: CandidateWithScore[] }> {
  if (!isUuid(batchId)) return { pm: [], spm: [] }
  const rows = await sql`
    select c.*, s.metric_1_score, s.metric_1_rationale, s.metric_2_score, s.metric_2_rationale,
           s.metric_3_score, s.metric_3_rationale, s.metric_4_score, s.metric_4_rationale,
           s.metric_5_score, s.metric_5_rationale, s.total_raw, s.total_100,
           s.flag_hidden_fit, s.flag_spec_shallow
    from candidates c
    join scores s on s.candidate_id = c.id
    where c.batch_id = ${batchId}
    order by s.total_100 desc
  `
  const all = rows.map(mapRow)
  return {
    pm: all.filter((c) => c.role === 'PM'),
    spm: all.filter((c) => c.role === 'SPM'),
  }
}
