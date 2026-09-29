import { describe, it, expect } from 'vitest'
import { checkPassword, createSessionCookieValue, isValidSessionCookieValue } from '@/lib/auth'

describe('checkPassword', () => {
  it('accepts the correct password', () => {
    expect(checkPassword(process.env.APP_PASSWORD!)).toBe(true)
  })
  it('rejects an incorrect password', () => {
    expect(checkPassword('definitely-wrong')).toBe(false)
  })
})

describe('session cookie', () => {
  it('a freshly created cookie value is valid', () => {
    expect(isValidSessionCookieValue(createSessionCookieValue())).toBe(true)
  })
  it('rejects a tampered value', () => {
    const value = createSessionCookieValue()
    const tampered = value.slice(0, -1) + (value.endsWith('a') ? 'b' : 'a')
    expect(isValidSessionCookieValue(tampered)).toBe(false)
  })
  it('rejects undefined/empty', () => {
    expect(isValidSessionCookieValue(undefined)).toBe(false)
    expect(isValidSessionCookieValue('')).toBe(false)
  })
})
