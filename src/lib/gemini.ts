import { GoogleGenAI, Type } from '@google/genai'
import { buildPrompt, Role } from '@/lib/rubric'

export type MetricResult = { score: number; rationale: string }
export type GeminiScoreResult = {
  candidateName: string
  candidateEmail: string
  metric1: MetricResult
  metric2: MetricResult
  metric3: MetricResult
  metric4: MetricResult
  metric5: MetricResult
}

export class GeminiScoringError extends Error {}

const METRIC_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER },
    rationale: { type: Type.STRING },
  },
  required: ['score', 'rationale'],
}

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    candidateName: { type: Type.STRING },
    candidateEmail: { type: Type.STRING },
    metric1: METRIC_SCHEMA,
    metric2: METRIC_SCHEMA,
    metric3: METRIC_SCHEMA,
    metric4: METRIC_SCHEMA,
    metric5: METRIC_SCHEMA,
  },
  required: ['candidateName', 'candidateEmail', 'metric1', 'metric2', 'metric3', 'metric4', 'metric5'],
}

function isValidResult(data: unknown): data is GeminiScoreResult {
  if (!data || typeof data !== 'object') return false
  const record = data as Record<string, unknown>
  if (typeof record.candidateName !== 'string' || typeof record.candidateEmail !== 'string') {
    return false
  }
  const keys = ['metric1', 'metric2', 'metric3', 'metric4', 'metric5'] as const
  return keys.every((k) => {
    const m = record[k]
    return (
      typeof m === 'object' && m !== null &&
      typeof (m as MetricResult).score === 'number' &&
      (m as MetricResult).score >= 1 && (m as MetricResult).score <= 4 &&
      typeof (m as MetricResult).rationale === 'string'
    )
  })
}

async function callOnce(client: GoogleGenAI, prompt: string): Promise<GeminiScoreResult | null> {
  const response = await client.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  })
  const text = response.text
  if (!text) return null
  try {
    const data = JSON.parse(text)
    return isValidResult(data) ? data : null
  } catch {
    return null
  }
}

export async function scoreResume(
  resumeText: string,
  role: Role,
  client: GoogleGenAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
): Promise<GeminiScoreResult> {
  const prompt = buildPrompt(resumeText, role)

  const first = await callOnce(client, prompt)
  if (first) return first

  const retry = await callOnce(client, prompt)
  if (retry) return retry

  throw new GeminiScoringError('Gemini returned an unparseable or invalid score twice in a row.')
}
