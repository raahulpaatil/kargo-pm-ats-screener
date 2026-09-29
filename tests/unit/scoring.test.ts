import { describe, it, expect } from 'vitest'
import { computeTotals, computeFlags, MetricScores } from '@/lib/scoring'

const base: MetricScores = { metric1: 2, metric2: 2, metric3: 2, metric4: 2, metric5: 2 }

describe('computeTotals', () => {
  it('sums the five metrics and scales by 5', () => {
    expect(computeTotals(base)).toEqual({ totalRaw: 10, total100: 50 })
  })
  it('handles the minimum (all 1s)', () => {
    const min: MetricScores = { metric1: 1, metric2: 1, metric3: 1, metric4: 1, metric5: 1 }
    expect(computeTotals(min)).toEqual({ totalRaw: 5, total100: 25 })
  })
  it('handles the maximum (all 4s)', () => {
    const max: MetricScores = { metric1: 4, metric2: 4, metric3: 4, metric4: 4, metric5: 4 }
    expect(computeTotals(max)).toEqual({ totalRaw: 20, total100: 100 })
  })
})

describe('computeFlags', () => {
  it('flags hidden fit: 1-3 all 4, metric5 low', () => {
    const s: MetricScores = { metric1: 4, metric2: 4, metric3: 4, metric4: 2, metric5: 1 }
    expect(computeFlags(s)).toEqual({ flagHiddenFit: true, flagSpecShallow: false })
  })
  it('does not flag hidden fit if metric5 is 3', () => {
    const s: MetricScores = { metric1: 4, metric2: 4, metric3: 4, metric4: 2, metric5: 3 }
    expect(computeFlags(s).flagHiddenFit).toBe(false)
  })
  it('does not flag hidden fit if one of 1-3 is below 4', () => {
    const s: MetricScores = { metric1: 4, metric2: 3, metric3: 4, metric4: 2, metric5: 1 }
    expect(computeFlags(s).flagHiddenFit).toBe(false)
  })
  it('flags spec-shallow: 4-5 both high, 1-3 average low', () => {
    const s: MetricScores = { metric1: 2, metric2: 2, metric3: 2, metric4: 4, metric5: 3 }
    expect(computeFlags(s)).toEqual({ flagHiddenFit: false, flagSpecShallow: true })
  })
  it('does not flag spec-shallow if metric4 is below 3', () => {
    const s: MetricScores = { metric1: 2, metric2: 2, metric3: 2, metric4: 2, metric5: 3 }
    expect(computeFlags(s).flagSpecShallow).toBe(false)
  })
  it('does not flag spec-shallow if 1-3 average is above 2', () => {
    const s: MetricScores = { metric1: 3, metric2: 2, metric3: 2, metric4: 4, metric5: 4 }
    expect(computeFlags(s).flagSpecShallow).toBe(false)
  })
  it('flags neither when scores are balanced', () => {
    expect(computeFlags(base)).toEqual({ flagHiddenFit: false, flagSpecShallow: false })
  })
})
