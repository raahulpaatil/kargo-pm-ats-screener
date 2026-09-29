import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/blob-token/route'

function makeTokenRequest(pathname: string) {
  const body = {
    type: 'blob.generate-client-token',
    payload: {
      pathname,
      callbackUrl: 'http://localhost:3000/api/blob-token',
      multipart: false,
      clientPayload: null,
    },
  }
  return new Request('http://localhost:3000/api/blob-token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/blob-token', () => {
  it('issues a client token for a pdf pathname', async () => {
    const res = await POST(makeTokenRequest('resumes/sample.pdf'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(typeof json.clientToken).toBe('string')

    // The client token embeds the allowed-content-type constraint that
    // onBeforeGenerateToken set. Decode it to confirm the constraint is the
    // one the route declares (PDF/DOCX only), not just that a token exists.
    const { getPayloadFromClientToken } = await import('@vercel/blob/client')
    const decoded = getPayloadFromClientToken(json.clientToken)
    expect(decoded.allowedContentTypes).toEqual([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ])
  })

  it('issues a client token for a docx pathname', async () => {
    const res = await POST(makeTokenRequest('resumes/sample.docx'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(typeof json.clientToken).toBe('string')
  })
})
