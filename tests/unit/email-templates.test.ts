import { describe, it, expect } from 'vitest'
import { buildDecisionEmail } from '@/lib/email-templates'

describe('buildDecisionEmail', () => {
  it('builds an accept email addressed to the candidate', () => {
    const email = buildDecisionEmail('Jane Doe', 'jane@example.com', 'PM', 'accepted')
    expect(email.to).toBe('jane@example.com')
    expect(email.subject).toContain('Product Manager')
    expect(email.body).toContain('Jane')
    expect(email.body.toLowerCase()).toContain('move forward')
  })

  it('builds a reject email addressed to the candidate', () => {
    const email = buildDecisionEmail('Jane Doe', 'jane@example.com', 'SPM', 'rejected')
    expect(email.to).toBe('jane@example.com')
    expect(email.subject).toContain('Senior Product Manager')
    expect(email.body).toContain('Jane')
    expect(email.body.toLowerCase()).toContain('not to move forward')
  })

  it('falls back to a generic greeting when the candidate has no name', () => {
    const email = buildDecisionEmail(null, 'jane@example.com', 'PM', 'accepted')
    expect(email.body).toContain('Hi there')
  })

  it('accept and reject bodies are genuinely different, not just the subject', () => {
    const accept = buildDecisionEmail('Jane Doe', 'jane@example.com', 'PM', 'accepted')
    const reject = buildDecisionEmail('Jane Doe', 'jane@example.com', 'PM', 'rejected')
    expect(accept.body).not.toBe(reject.body)
  })
})
