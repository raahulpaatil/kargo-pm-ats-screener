export type MetricScores = {
  metric1: number
  metric2: number
  metric3: number
  metric4: number
  metric5: number
}

export function computeTotals(scores: MetricScores): { totalRaw: number; total100: number } {
  const totalRaw = scores.metric1 + scores.metric2 + scores.metric3 + scores.metric4 + scores.metric5
  return { totalRaw, total100: totalRaw * 5 }
}

export function computeFlags(scores: MetricScores): { flagHiddenFit: boolean; flagSpecShallow: boolean } {
  const { metric1, metric2, metric3, metric4, metric5 } = scores

  const flagHiddenFit =
    metric1 === 4 && metric2 === 4 && metric3 === 4 && metric5 <= 2

  const avg123 = (metric1 + metric2 + metric3) / 3
  const flagSpecShallow = metric4 >= 3 && metric5 >= 3 && avg123 <= 2

  return { flagHiddenFit, flagSpecShallow }
}
