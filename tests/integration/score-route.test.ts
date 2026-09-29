import { describe, it, expect, vi, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { ExtractionError } from '@/lib/extract-text'
import { GeminiScoringError } from '@/lib/gemini'

vi.mock('@/lib/extract-text', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/extract-text')>()
  return { ...actual, extractText: vi.fn() }
})
vi.mock('@/lib/gemini', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/gemini')>()
  return { ...actual, scoreResume: vi.fn() }
})

import { extractText } from '@/lib/extract-text'
import { scoreResume } from '@/lib/gemini'
import { POST } from '@/app/api/score/route'

const mockedExtractText = vi.mocked(extractText)
const mockedScoreResume = vi.mocked(scoreResume)

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/score', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

// The route downloads the resume via the global `fetch`, but Neon's HTTP driver
// (used by `sql` for the real DB writes below) also goes through global `fetch`.
// Fully replacing it would break DB access, so this mock only intercepts the
// exact blob URL under test and passes every other call through to the real fetch.
const realFetch = global.fetch
function mockBlobDownload(blobUrl: string) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (input === blobUrl) {
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) } as unknown as Response
    }
    return realFetch(input, init)
  }) as unknown as typeof fetch
}

const validGeminiResult = {
  candidateName: 'Jane Doe',
  candidateEmail: 'jane@example.com',
  metric1: { score: 4, rationale: 'r1' },
  metric2: { score: 3, rationale: 'r2' },
  metric3: { score: 4, rationale: 'r3' },
  metric4: { score: 3, rationale: 'r4' },
  metric5: { score: 3, rationale: 'r5' },
}

describe('POST /api/score', () => {
  let insertedId: string | undefined

  afterEach(async () => {
    vi.restoreAllMocks()
    global.fetch = realFetch
    if (insertedId) {
      await sql`delete from candidates where id = ${insertedId}`
      insertedId = undefined
    }
  })

  it('rejects an unsupported file type before extraction/scoring', async () => {
    const res = await POST(makeRequest({ blobUrl: 'https://x/y.txt', fileName: 'resume.txt', role: 'PM' }))
    expect(res.status).toBe(400)
    expect(mockedExtractText).not.toHaveBeenCalled()
  })

  it('rejects a malformed batchId before extraction/scoring', async () => {
    const res = await POST(
      makeRequest({ blobUrl: 'https://x/y.pdf', fileName: 'resume.pdf', role: 'PM', batchId: 'not-a-uuid' })
    )
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(typeof json.error).toBe('string')
    expect(mockedExtractText).not.toHaveBeenCalled()
  })

  it('returns 400 with a clear message on ExtractionError', async () => {
    global.fetch = mockBlobDownload('https://x/y.pdf')
    mockedExtractText.mockRejectedValue(new ExtractionError('scanned/image-only'))
    const res = await POST(makeRequest({ blobUrl: 'https://x/y.pdf', fileName: 'resume.pdf', role: 'PM' }))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toContain('scanned/image-only')
  })

  it('returns 502 with a clear message on GeminiScoringError', async () => {
    global.fetch = mockBlobDownload('https://x/y.pdf')
    mockedExtractText.mockResolvedValue('extracted resume text')
    mockedScoreResume.mockRejectedValue(new GeminiScoringError('gave up after two tries'))
    const res = await POST(makeRequest({ blobUrl: 'https://x/y.pdf', fileName: 'resume.pdf', role: 'PM' }))
    const json = await res.json()
    expect(res.status).toBe(502)
    expect(json.error).toContain('gave up after two tries')
  })

  it('writes a candidate + score row and returns the combined result on success', async () => {
    global.fetch = mockBlobDownload('https://x/y.pdf')
    mockedExtractText.mockResolvedValue('extracted resume text')
    mockedScoreResume.mockResolvedValue(validGeminiResult)

    const res = await POST(makeRequest({ blobUrl: 'https://x/y.pdf', fileName: 'resume.pdf', role: 'PM' }))
    const json = await res.json()
    insertedId = json.id

    expect(res.status).toBe(200)
    expect(json.name).toBe('Jane Doe')
    expect(json.score.totalRaw).toBe(17)
    expect(json.score.total100).toBe(85)

    const rows = await sql`select * from scores where candidate_id = ${json.id}`
    expect(rows).toHaveLength(1)
  })
})
