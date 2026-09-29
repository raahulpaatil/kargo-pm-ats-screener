import nodemailer, { type Transporter } from 'nodemailer'
import type { DecisionEmailContent } from '@/lib/email-templates'

export class MailSendError extends Error {}

function createGmailTransport(user: string, pass: string): Transporter {
  return nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } })
}

export async function sendDecisionEmail(
  email: DecisionEmailContent,
  transport?: Transporter
): Promise<{ id: string }> {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD
  if (!user || !pass) {
    throw new MailSendError('Gmail is not configured (set GMAIL_USER and GMAIL_APP_PASSWORD).')
  }

  try {
    const info = await (transport ?? createGmailTransport(user, pass)).sendMail({
      from: `Kargo Hiring <${user}>`,
      to: email.to,
      subject: email.subject,
      text: email.body,
    })
    return { id: info.messageId }
  } catch (err) {
    throw new MailSendError(err instanceof Error ? err.message : 'Unknown mail error.')
  }
}
