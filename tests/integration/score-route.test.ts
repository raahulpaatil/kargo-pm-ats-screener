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
vi.mock('@vercel/blob', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vercel/blob')>()
  return { ...actual, get: vi.fn() }
})

import { extractText } from '@/lib/extract-text'
import { scoreResume } from '@/lib/gemini'
import { get } from '@vercel/blob'
import { POST } from '@/app/api/score/route'

const mockedExtractText = vi.mocked(extractText)
const mockedScoreResume = vi.mocked(scoreResume)
const mockedGet = vi.mocked(get)

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/score', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  })
}

// The store is private-access-only, so the route reads the uploaded blob via
// @vercel/blob's authenticated `get` rather than plain `fetch`. Mocking `get`
// directly (instead of intercepting global fetch) also sidesteps any risk of
// interfering with Neon's HTTP driver, which uses fetch for the real DB
// writes below.
function mockBlobGet() {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(8))
      controller.close()
    },
  })
  mockedGet.mockResolvedValue({
    statusCode: 200,
    stream,
    headers: new Headers(),
    blob: {
      url: 'https://x/y.pdf',
      downloadUrl: 'https://x/y.pdf',
      pathname: 'y.pdf',
      contentDisposition: 'inline',
      cacheControl: 'public, max-age=0',
      uploadedAt: new Date(),
      etag: 'etag',
      contentType: 'application/pdf',
      size: 8,
    },
  })
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
    mockBlobGet()
    mockedExtractText.mockRejectedValue(new ExtractionError('scanned/image-only'))
    const res = await POST(makeRequest({ blobUrl: 'https://x/y.pdf', fileName: 'resume.pdf', role: 'PM' }))
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.error).toContain('scanned/image-only')
  })

  it('returns 502 with a clear message on GeminiScoringError', async () => {
    mockBlobGet()
    mockedExtractText.mockResolvedValue('extracted resume text')
    mockedScoreResume.mockRejectedValue(new GeminiScoringError('gave up after two tries'))
    const res = await POST(makeRequest({ blobUrl: 'https://x/y.pdf', fileName: 'resume.pdf', role: 'PM' }))
    const json = await res.json()
    expect(res.status).toBe(502)
    expect(json.error).toContain('gave up after two tries')
  })

  it('writes a candidate + score row and returns the combined result on success', async () => {
    mockBlobGet()
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
