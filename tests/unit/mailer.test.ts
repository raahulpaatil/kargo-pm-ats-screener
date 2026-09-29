import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendDecisionEmail, MailSendError } from '@/lib/mailer'
import type { DecisionEmailContent } from '@/lib/email-templates'
import type { Transporter } from 'nodemailer'

const sampleEmail: DecisionEmailContent = {
  to: 'jane@example.com',
  subject: 'Your application for Product Manager at Kargo',
  body: 'Hi Jane,\n\nThank you...',
}

function mockTransport(impl: () => Promise<{ messageId: string }>): Transporter {
  return { sendMail: vi.fn(impl) } as unknown as Transporter
}

describe('sendDecisionEmail', () => {
  beforeEach(() => {
    vi.stubEnv('GMAIL_USER', 'hiring@gmail.com')
    vi.stubEnv('GMAIL_APP_PASSWORD', 'abcd efgh ijkl mnop')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('sends from the configured Gmail address and returns the message id', async () => {
    const transport = mockTransport(async () => ({ messageId: '<abc@gmail.com>' }))
    const result = await sendDecisionEmail(sampleEmail, transport)
    expect(result.id).toBe('<abc@gmail.com>')
    expect(transport.sendMail).toHaveBeenCalledWith({
      from: 'Kargo Hiring <hiring@gmail.com>',
      to: sampleEmail.to,
      subject: sampleEmail.subject,
      text: sampleEmail.body,
    })
  })

  it('wraps transport failures in MailSendError', async () => {
    const transport = mockTransport(async () => {
      throw new Error('Invalid login')
    })
    await expect(sendDecisionEmail(sampleEmail, transport)).rejects.toThrow(MailSendError)
    await expect(sendDecisionEmail(sampleEmail, transport)).rejects.toThrow('Invalid login')
  })

  it('throws MailSendError when Gmail credentials are not configured', async () => {
    vi.stubEnv('GMAIL_USER', '')
    await expect(sendDecisionEmail(sampleEmail)).rejects.toThrow(MailSendError)
  })
})
