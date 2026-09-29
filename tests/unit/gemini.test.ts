import { describe, it, expect, vi } from 'vitest'
import { scoreResume, GeminiScoringError } from '@/lib/gemini'
import type { GoogleGenAI } from '@google/genai'

function mockClient(responses: (string | null)[]): GoogleGenAI {
  const generateContent = vi.fn()
  for (const r of responses) {
    generateContent.mockResolvedValueOnce({ text: r })
  }
  return { models: { generateContent } } as unknown as GoogleGenAI
}

const validJson = JSON.stringify({
  candidateName: 'Jane Doe',
  candidateEmail: 'jane@example.com',
  metric1: { score: 4, rationale: 'ex-ops exec' },
  metric2: { score: 3, rationale: 'built a tool overnight' },
  metric3: { score: 4, rationale: 'sole PM, no escalation' },
  metric4: { score: 3, rationale: 'shipped and killed a feature' },
  metric5: { score: 3, rationale: '3 years PM experience' },
})

describe('scoreResume', () => {
  it('returns the parsed result on a valid first response', async () => {
    const client = mockClient([validJson])
    const result = await scoreResume('resume text', 'PM', client)
    expect(result.metric1.score).toBe(4)
    expect(result.metric3.rationale).toContain('no escalation')
    expect(result.candidateName).toBe('Jane Doe')
    expect(result.candidateEmail).toBe('jane@example.com')
  })

  it('retries once on malformed JSON, then succeeds', async () => {
    const client = mockClient(['not json', validJson])
    const result = await scoreResume('resume text', 'PM', client)
    expect(result.metric4.score).toBe(3)
    expect(client.models.generateContent).toHaveBeenCalledTimes(2)
  })

  it('throws GeminiScoringError after two malformed responses', async () => {
    const client = mockClient(['not json', 'still not json'])
    await expect(scoreResume('resume text', 'PM', client)).rejects.toThrow(GeminiScoringError)
  })

  it('throws GeminiScoringError if a score is out of range', async () => {
    const bad = JSON.stringify({ ...JSON.parse(validJson), metric1: { score: 9, rationale: 'x' } })
    const client = mockClient([bad, bad])
    await expect(scoreResume('resume text', 'PM', client)).rejects.toThrow(GeminiScoringError)
  })
})
