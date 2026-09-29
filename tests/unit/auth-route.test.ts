import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/route'
import { SESSION_COOKIE_NAME } from '@/lib/auth'

function makeRequest(password: unknown) {
  return new NextRequest('http://localhost:3000/api/auth', {
    method: 'POST',
    body: JSON.stringify({ password }),
    headers: { 'content-type': 'application/json' },
  })
}

describe('POST /api/auth', () => {
  it('sets a session cookie on correct password', async () => {
    const res = await POST(makeRequest(process.env.APP_PASSWORD))
    expect(res.status).toBe(200)
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeTruthy()
  })

  it('returns 401 on incorrect password', async () => {
    const res = await POST(makeRequest('wrong'))
    expect(res.status).toBe(401)
    expect(res.cookies.get(SESSION_COOKIE_NAME)).toBeFalsy()
  })
})
