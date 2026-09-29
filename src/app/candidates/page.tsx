export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getAllCandidates } from '@/lib/candidates'
import { AllCandidatesTable } from '@/components/AllCandidatesTable'
import { TopBar } from '@/components/TopBar'

export default async function CandidatesPage() {
  const candidates = await getAllCandidates()
  const pending = candidates.filter((c) => c.status === 'pending').length

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 max-w-5xl mx-auto w-full">
      <TopBar
        title="All Candidates"
        subtitle={pending > 0 ? `${pending} awaiting your decision` : 'All caught up'}
      >
        <Link href="/" className="text-accent text-sm font-medium hover:underline mr-2">
          + Score more resumes
        </Link>
      </TopBar>
      <AllCandidatesTable candidates={candidates} />
    </main>
  )
}
