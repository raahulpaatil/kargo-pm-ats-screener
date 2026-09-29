export type VerdictKey = 'shortlist' | 'maybe' | 'pass'

export type Verdict = {
  key: VerdictKey
  label: string
  text: string
  soft: string
  stroke: string
  solid: string
}

// Class names are spelled out in full so Tailwind can see them.
const VERDICTS: Record<VerdictKey, Verdict> = {
  shortlist: { key: 'shortlist', label: 'Shortlist', text: 'text-good', soft: 'bg-good/15 text-good', stroke: 'stroke-good', solid: 'bg-good' },
  maybe: { key: 'maybe', label: 'Maybe', text: 'text-warn', soft: 'bg-warn/15 text-warn', stroke: 'stroke-warn', solid: 'bg-warn' },
  pass: { key: 'pass', label: 'Pass', text: 'text-danger', soft: 'bg-danger/15 text-danger', stroke: 'stroke-danger', solid: 'bg-danger' },
}

// Suggested triage bands for the 0-100 score. The rubric defines no cutoff, so
// these are a UI aid only; a Hidden Fit candidate is never shown as a plain Pass.
export function verdictFor(total100: number, flagHiddenFit: boolean): Verdict {
  if (total100 >= 75) return VERDICTS.shortlist
  if (total100 >= 50 || flagHiddenFit) return VERDICTS.maybe
  return VERDICTS.pass
}

// Metric pips run 0-4; same color language as the verdict.
export function metricColor(value: number): { pip: string; text: string } {
  if (value >= 3) return { pip: 'bg-good', text: 'text-good' }
  if (value === 2) return { pip: 'bg-warn', text: 'text-warn' }
  return { pip: 'bg-danger', text: 'text-danger' }
}
