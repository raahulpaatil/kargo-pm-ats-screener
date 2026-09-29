import { describe, it, expect } from 'vitest'
import { buildPrompt } from '@/lib/rubric'

describe('buildPrompt', () => {
  it('includes PM-specific Metric 4 bar for PM role', () => {
    const prompt = buildPrompt('some resume text', 'PM')
    expect(prompt).toContain('0-to-1 process creation')
    expect(prompt).not.toContain('integration/architecture trade-off with')
  })

  it('includes SPM-specific Metric 4 bar for SPM role', () => {
    const prompt = buildPrompt('some resume text', 'SPM')
    expect(prompt).toContain('integration/architecture trade-off with')
    expect(prompt).not.toContain('0-to-1 process creation')
  })

  it('includes the resume text verbatim', () => {
    const prompt = buildPrompt('UNIQUE_MARKER_TEXT_12345', 'PM')
    expect(prompt).toContain('UNIQUE_MARKER_TEXT_12345')
  })

  it('instructs the model to treat resume text as untrusted data, not instructions', () => {
    const prompt = buildPrompt('some resume text', 'PM')
    expect(prompt).toContain('untrusted')
    expect(prompt.toLowerCase()).toContain('never as instructions')
  })
})
