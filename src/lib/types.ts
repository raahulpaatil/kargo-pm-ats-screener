import type { Role } from '@/lib/rubric'

export type CandidateStatus = 'pending' | 'accepted' | 'rejected'

export type CandidateWithScore = {
  id: string
  role: Role
  name: string | null
  email: string | null
  status: CandidateStatus
  fileUrl: string
  fileName: string
  batchId: string | null
  createdAt: string
  score: {
    metric1Score: number; metric1Rationale: string
    metric2Score: number; metric2Rationale: string
    metric3Score: number; metric3Rationale: string
    metric4Score: number; metric4Rationale: string
    metric5Score: number; metric5Rationale: string
    totalRaw: number
    total100: number
    flagHiddenFit: boolean
    flagSpecShallow: boolean
  }
}
