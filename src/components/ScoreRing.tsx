export function ScoreRing({ score }: { score: number }) {
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 70 ? 'stroke-good' : score >= 50 ? 'stroke-warn' : 'stroke-danger'

  return (
    <div className="relative w-48 h-48">
      <svg className="w-48 h-48 -rotate-90" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={radius} strokeWidth="12" className="stroke-canvas" fill="none" />
        <circle
          cx="80" cy="80" r={radius} strokeWidth="12" fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className={`${color} transition-all duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-semibold text-ink">{score}</span>
        <span className="text-subtle text-sm">/ 100</span>
      </div>
    </div>
  )
}
