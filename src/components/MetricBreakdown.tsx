import type { CandidateWithScore } from '@/lib/types'

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
      {metrics.map((m) => (
        <div key={m.label} className="bg-surface shadow-soft rounded-xl2 p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-ink">{m.label}</h3>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((pip) => (
                <span key={pip} className={`w-3 h-3 rounded-full ${pip <= m.value ? 'bg-accent' : 'bg-canvas'}`} />
              ))}
            </div>
          </div>
          <p className="text-subtle text-sm">{m.rationale}</p>
        </div>
      ))}
    </div>
  )
}
