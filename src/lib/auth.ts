import { createHmac, timingSafeEqual } from 'crypto'

export const SESSION_COOKIE_NAME = 'ats_session'
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

function sign(payload: string): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not set')
  return createHmac('sha256', secret).update(payload).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function checkPassword(candidate: string): boolean {
  const expected = process.env.APP_PASSWORD
  if (!expected) throw new Error('APP_PASSWORD is not set')
  return safeEqual(candidate, expected)
}

export function createSessionCookieValue(): string {
  const expiry = Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  const payload = String(expiry)
  return `${payload}.${sign(payload)}`
}

export function isValidSessionCookieValue(value: string | undefined | null): boolean {
  if (!value) return false
  const parts = value.split('.')
  if (parts.length !== 2) return false
  const [payload, signature] = parts
  if (Date.now() > Number(payload)) return false
  return safeEqual(signature, sign(payload))
}
