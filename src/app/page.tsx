export const dynamic = 'force-dynamic'

import { getAllCandidates } from '@/lib/candidates'
import { verdictFor } from '@/lib/verdict'
import { HomeExperience } from '@/components/HomeExperience'
import type { FilmFrame } from '@/components/scene/Filmstrip'

export default async function HomePage() {
  // The reel shows the most recently scored candidates.
  const candidates = await getAllCandidates().catch(() => [])
  const frames: FilmFrame[] = [...candidates]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 8)
    .map((c) => ({
      id: c.id,
      name: c.name || 'Unnamed Candidate',
      score: c.score.total100,
      verdict: verdictFor(c.score.total100, c.score.flagHiddenFit).label,
      role: c.role,
      href: `/candidate/${c.id}`,
    }))

  return <HomeExperience frames={frames} />
}
