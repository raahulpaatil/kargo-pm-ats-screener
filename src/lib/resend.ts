import { Resend } from 'resend'
import type { DecisionEmailContent } from '@/lib/email-templates'

export class ResendSendError extends Error {}

export async function sendDecisionEmail(
  email: DecisionEmailContent,
  client: Resend = new Resend(process.env.RESEND_API_KEY)
): Promise<{ id: string }> {
  const { data, error } = await client.emails.send({
    from: email.from,
    to: email.to,
    subject: email.subject,
    text: email.body,
  })

  if (error) {
    throw new ResendSendError(error.message)
  }
  if (!data) {
    throw new ResendSendError('Resend returned no data and no error.')
  }
  return { id: data.id }
}
