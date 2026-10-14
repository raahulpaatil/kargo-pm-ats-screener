import type { CandidateWithScore } from '@/lib/types'
import { metricColor } from '@/lib/verdict'

const METRIC_LABELS = [
  'Ground-Level Domain Grounding',
  'Self-Initiated Ownership',
  'Decision Autonomy Track Record',
  'Role-Calibrated Product Craft',
  'Scale-Appropriate Experience',
]

export function MetricBreakdown({ score }: { score: CandidateWithScore['score'] }) {
  const metrics = [
    { label: METRIC_LABELS[0], value: score.metric1Score, rationale: score.metric1Rationale },
    { label: METRIC_LABELS[1], value: score.metric2Score, rationale: score.metric2Rationale },
    { label: METRIC_LABELS[2], value: score.metric3Score, rationale: score.metric3Rationale },
    { label: METRIC_LABELS[3], value: score.metric4Score, rationale: score.metric4Rationale },
    { label: METRIC_LABELS[4], value: score.metric5Score, rationale: score.metric5Rationale },
  ]

  return (
    <div className="space-y-4">
      {metrics.map((m) => {
        const color = metricColor(m.value)
        return (
          <div key={m.label} className="bg-surface/80 shadow-soft border border-line rounded-xl2 p-5">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h3 className="text-lg font-semibold text-ink">{m.label}</h3>
              <div className="flex items-center gap-2 shrink-0" role="img" aria-label={`${m.value} out of 4`}>
                <div className="flex gap-[3px] border border-line p-[3px] rounded-sm">
                  {[1, 2, 3, 4].map((pip) => (
                    <span key={pip} className={`w-4 h-3 ${pip <= m.value ? color.pip : 'bg-line/60'}`} />
                  ))}
                </div>
                <span className={`pixel text-xl tabular-nums ${color.text}`}>{m.value}/4</span>
              </div>
            </div>
            <p className="text-subtle leading-relaxed">{m.rationale}</p>
          </div>
        )
      })}
    </div>
  )
}
