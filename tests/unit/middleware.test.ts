import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy as middleware } from '@/proxy'
import { createSessionCookieValue, SESSION_COOKIE_NAME } from '@/lib/auth'

describe('middleware', () => {
  it('redirects an unauthenticated page request to /login', () => {
    const req = new NextRequest('http://localhost:3000/')
    const res = middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('returns 401 for an unauthenticated API request', () => {
    const req = new NextRequest('http://localhost:3000/api/score')
    const res = middleware(req)
    expect(res.status).toBe(401)
  })

  it('passes through an authenticated page request', () => {
    const req = new NextRequest('http://localhost:3000/', {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${createSessionCookieValue()}` },
    })
    const res = middleware(req)
    expect(res.status).toBe(200)
  })

  it('never blocks /login or /api/auth', () => {
    expect(middleware(new NextRequest('http://localhost:3000/login')).status).toBe(200)
    expect(middleware(new NextRequest('http://localhost:3000/api/auth')).status).toBe(200)
  })
})
