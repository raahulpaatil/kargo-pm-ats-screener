import { describe, it, expect } from 'vitest'
import { verdictFor } from '@/lib/verdict'

describe('verdictFor', () => {
  it('shortlists at 75 and above', () => {
    expect(verdictFor(75, false).key).toBe('shortlist')
    expect(verdictFor(100, false).key).toBe('shortlist')
  })

  it('marks 50-74 as maybe', () => {
    expect(verdictFor(50, false).key).toBe('maybe')
    expect(verdictFor(74, false).key).toBe('maybe')
  })

  it('passes below 50', () => {
    expect(verdictFor(49, false).key).toBe('pass')
    expect(verdictFor(0, false).key).toBe('pass')
  })

  it('lifts a low score to maybe when the Hidden Fit flag is set', () => {
    expect(verdictFor(40, true).key).toBe('maybe')
  })

  it('does not change a shortlist verdict for Hidden Fit', () => {
    expect(verdictFor(80, true).key).toBe('shortlist')
  })
})
