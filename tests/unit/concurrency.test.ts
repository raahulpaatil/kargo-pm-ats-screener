import { describe, it, expect } from 'vitest'
import { runWithConcurrency } from '@/lib/concurrency'

describe('runWithConcurrency', () => {
  it('preserves result order even when later items resolve first', async () => {
    const items = [30, 10, 20]
    const results = await runWithConcurrency(
      items, 3,
      (ms) => new Promise((resolve) => setTimeout(() => resolve(ms), ms))
    )
    expect(results).toEqual([30, 10, 20])
  })

  it('never runs more than `limit` workers concurrently', async () => {
    let active = 0
    let maxActive = 0
    const items = Array.from({ length: 10 }, (_, i) => i)
    await runWithConcurrency(items, 3, async (i) => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 5))
      active--
      return i
    })
    expect(maxActive).toBeLessThanOrEqual(3)
  })

  it('handles an empty array', async () => {
    const results = await runWithConcurrency([], 5, async (x: number) => x)
    expect(results).toEqual([])
  })
})
