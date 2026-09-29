import { describe, it, expect, vi } from 'vitest'
import { sendDecisionEmail, ResendSendError } from '@/lib/resend'
import type { DecisionEmailContent } from '@/lib/email-templates'
import type { Resend } from 'resend'

const sampleEmail: DecisionEmailContent = {
  to: 'jane@example.com',
  from: 'Kargo Hiring <onboarding@resend.dev>',
  subject: 'Your application for Product Manager at Kargo',
  body: 'Hi Jane,\n\nThank you...',
}

function mockClient(result: { data?: { id: string } | null; error?: { message: string } | null }): Resend {
  const send = vi.fn().mockResolvedValue(result)
  return { emails: { send } } as unknown as Resend
}

describe('sendDecisionEmail', () => {
  it('sends the email via the Resend client and returns the message id', async () => {
    const client = mockClient({ data: { id: 'msg_123' }, error: null })
    const result = await sendDecisionEmail(sampleEmail, client)
    expect(result.id).toBe('msg_123')
    expect(client.emails.send).toHaveBeenCalledWith({
      from: sampleEmail.from,
      to: sampleEmail.to,
      subject: sampleEmail.subject,
      text: sampleEmail.body,
    })
  })

  it('throws ResendSendError when Resend returns an error', async () => {
    const client = mockClient({ data: null, error: { message: 'Invalid from address' } })
    await expect(sendDecisionEmail(sampleEmail, client)).rejects.toThrow(ResendSendError)
    await expect(sendDecisionEmail(sampleEmail, client)).rejects.toThrow('Invalid from address')
  })

  it('throws ResendSendError when Resend returns no data and no error', async () => {
    const client = mockClient({ data: null, error: null })
    await expect(sendDecisionEmail(sampleEmail, client)).rejects.toThrow(ResendSendError)
  })
})
