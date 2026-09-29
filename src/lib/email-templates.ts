import type { Role } from '@/lib/rubric'

export type DecisionEmailContent = {
  to: string
  subject: string
  body: string
}

const ROLE_LABEL: Record<Role, string> = {
  PM: 'Product Manager',
  SPM: 'Senior Product Manager',
}

export function buildDecisionEmail(
  candidateName: string | null,
  candidateEmail: string,
  role: Role,
  decision: 'accepted' | 'rejected'
): DecisionEmailContent {
  const greeting = candidateName ? `Hi ${candidateName.split(' ')[0]}` : 'Hi there'
  const roleLabel = ROLE_LABEL[role]
  const subject = `Your application for ${roleLabel} at Kargo`

  const body =
    decision === 'accepted'
      ? `${greeting},\n\nThank you for applying for the ${roleLabel} role at Kargo. We were impressed by your background and would like to move forward with your application.\n\nSomeone from our hiring team will be in touch shortly with next steps.\n\nBest,\nKargo Hiring Team`
      : `${greeting},\n\nThank you for taking the time to apply for the ${roleLabel} role at Kargo, and for sharing your background with us.\n\nAfter careful consideration, we've decided not to move forward with your application at this time. We appreciate your interest in Kargo and wish you the best in your search.\n\nBest,\nKargo Hiring Team`

  return { to: candidateEmail, subject, body }
}
