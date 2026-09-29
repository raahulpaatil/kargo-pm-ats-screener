import { getBatchCandidates } from '@/lib/candidates'
import { BatchTable } from '@/components/BatchTable'

export default async function BatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params
  const { pm, spm } = await getBatchCandidates(batchId)

  return (
    <main className="min-h-screen bg-canvas p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold text-ink mb-6">Batch Results</h1>
      <BatchTable pm={pm} spm={spm} />
    </main>
  )
}
