import Link from 'next/link'
import { getAllCandidates } from '@/lib/candidates'
import { AllCandidatesTable } from '@/components/AllCandidatesTable'

export default async function CandidatesPage() {
  const candidates = await getAllCandidates()

  return (
    <main className="min-h-screen bg-canvas p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-ink">All Candidates</h1>
        <Link href="/" className="text-accent text-sm font-medium hover:underline">
          + Score more resumes
        </Link>
      </div>
      <AllCandidatesTable candidates={candidates} />
    </main>
  )
}
