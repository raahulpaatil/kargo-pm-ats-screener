export const dynamic = 'force-dynamic'

import { getAllCandidates } from '@/lib/candidates'
import { AllCandidatesTable } from '@/components/AllCandidatesTable'
import { TopBar, PromptLink } from '@/components/TopBar'

export default async function CandidatesPage() {
  const candidates = await getAllCandidates()
  const pending = candidates.filter((c) => c.status === 'pending').length

  return (
    <main id="main" className="min-h-svh px-5 sm:px-8 py-6 sm:py-8 max-w-6xl mx-auto w-full">
      <TopBar
        title="All Candidates"
        subtitle={pending > 0 ? `${pending} awaiting your decision` : 'All caught up'}
      >
        <PromptLink href="/#upload">Score more</PromptLink>
      </TopBar>
      <AllCandidatesTable candidates={candidates} />
    </main>
  )
}
