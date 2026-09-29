import { NextRequest, NextResponse } from 'next/server'
import { getBatchCandidates } from '@/lib/candidates'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params
  const result = await getBatchCandidates(batchId)
  return NextResponse.json(result)
}
