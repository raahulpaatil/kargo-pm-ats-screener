import { getBatchCandidates } from '@/lib/candidates'
import { BatchTable } from '@/components/BatchTable'
import { TopBar } from '@/components/TopBar'

export default async function BatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params
  const { pm, spm } = await getBatchCandidates(batchId)

  return (
    <main className="min-h-screen bg-canvas px-4 py-6 max-w-5xl mx-auto w-full">
      <TopBar title="Batch Results" subtitle={`${pm.length + spm.length} resumes scored — best matches first`} />
      <BatchTable pm={pm} spm={spm} batchId={batchId} />
    </main>
  )
}
