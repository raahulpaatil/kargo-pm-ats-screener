import { NextRequest, NextResponse } from 'next/server'
import { get } from '@vercel/blob'
import { sql } from '@/lib/db'
import { fileKindFromName, extractText, ExtractionError } from '@/lib/extract-text'
import { scoreResume, GeminiScoringError } from '@/lib/gemini'
import { computeTotals, computeFlags } from '@/lib/scoring'
import type { Role } from '@/lib/rubric'
import type { CandidateWithScore } from '@/lib/types'

type ScoreRequestBody = {
  blobUrl: string
  fileName: string
  role: Role
  batchId?: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidBody(body: unknown): body is ScoreRequestBody {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>
  return (
    typeof b.blobUrl === 'string' &&
    typeof b.fileName === 'string' &&
    (b.role === 'PM' || b.role === 'SPM') &&
    (b.batchId === undefined || (typeof b.batchId === 'string' && UUID_RE.test(b.batchId)))
  )
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => null)
  if (!isValidBody(body)) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const kind = fileKindFromName(body.fileName)
  if (!kind) {
    return NextResponse.json(
      { error: `Unsupported file type for "${body.fileName}". Only .pdf and .docx are accepted.` },
      { status: 400 }
    )
  }

  const blobResult = await get(body.blobUrl, { access: 'private' })
  if (!blobResult || blobResult.statusCode !== 200) {
    return NextResponse.json({ error: 'Could not download the uploaded file.' }, { status: 400 })
  }
  const buffer = Buffer.from(await new Response(blobResult.stream).arrayBuffer())

  let resumeText: string
  try {
    resumeText = await extractText(buffer, kind)
  } catch (err) {
    if (err instanceof ExtractionError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  let gemini
  try {
    gemini = await scoreResume(resumeText, body.role)
  } catch (err) {
    if (err instanceof GeminiScoringError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    throw err
  }

  const metricScores = {
    metric1: gemini.metric1.score,
    metric2: gemini.metric2.score,
    metric3: gemini.metric3.score,
    metric4: gemini.metric4.score,
    metric5: gemini.metric5.score,
  }
  const { totalRaw, total100 } = computeTotals(metricScores)
  const { flagHiddenFit, flagSpecShallow } = computeFlags(metricScores)

  const [candidate] = await sql`
    insert into candidates (role, name, email, file_url, file_name, resume_text, batch_id)
    values (
      ${body.role},
      ${gemini.candidateName || null},
      ${gemini.candidateEmail || null},
      ${body.blobUrl},
      ${body.fileName},
      ${resumeText},
      ${body.batchId || null}
    )
    returning id, role, name, email, status, file_url, file_name, batch_id, created_at
  `

  const [score] = await sql`
    insert into scores (
      candidate_id,
      metric_1_score, metric_1_rationale,
      metric_2_score, metric_2_rationale,
      metric_3_score, metric_3_rationale,
      metric_4_score, metric_4_rationale,
      metric_5_score, metric_5_rationale,
      total_raw, total_100, flag_hidden_fit, flag_spec_shallow
    ) values (
      ${candidate.id},
      ${gemini.metric1.score}, ${gemini.metric1.rationale},
      ${gemini.metric2.score}, ${gemini.metric2.rationale},
      ${gemini.metric3.score}, ${gemini.metric3.rationale},
      ${gemini.metric4.score}, ${gemini.metric4.rationale},
      ${gemini.metric5.score}, ${gemini.metric5.rationale},
      ${totalRaw}, ${total100}, ${flagHiddenFit}, ${flagSpecShallow}
    )
    returning *
  `

  const result: CandidateWithScore = {
    id: candidate.id as string,
    role: candidate.role as Role,
    name: candidate.name as string | null,
    email: candidate.email as string | null,
    status: candidate.status as CandidateWithScore['status'],
    fileUrl: candidate.file_url as string,
    fileName: candidate.file_name as string,
    batchId: candidate.batch_id as string | null,
    createdAt: candidate.created_at as string,
    score: {
      metric1Score: score.metric_1_score as number, metric1Rationale: score.metric_1_rationale as string,
      metric2Score: score.metric_2_score as number, metric2Rationale: score.metric_2_rationale as string,
      metric3Score: score.metric_3_score as number, metric3Rationale: score.metric_3_rationale as string,
      metric4Score: score.metric_4_score as number, metric4Rationale: score.metric_4_rationale as string,
      metric5Score: score.metric_5_score as number, metric5Rationale: score.metric_5_rationale as string,
      totalRaw: score.total_raw as number,
      total100: score.total_100 as number,
      flagHiddenFit: score.flag_hidden_fit as boolean,
      flagSpecShallow: score.flag_spec_shallow as boolean,
    },
  }

  return NextResponse.json(result)
}
