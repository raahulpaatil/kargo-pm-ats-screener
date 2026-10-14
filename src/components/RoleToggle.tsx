'use client'

import type { Role } from '@/lib/rubric'

export function RoleToggle({ role, onChange }: { role: Role; onChange: (role: Role) => void }) {
  return (
    <div role="group" aria-label="Role being screened" className="inline-flex border border-line rounded-md p-1 bg-canvas/60">
      {(['PM', 'SPM'] as const).map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={role === r}
          onClick={() => onChange(r)}
          className={`px-4 py-2 rounded-sm text-base transition-colors cursor-pointer ${
            role === r ? 'bg-ink text-canvas' : 'text-subtle hover:text-ink'
          }`}
        >
          {r === 'PM' ? 'Product Manager' : 'Senior Product Manager'}
        </button>
      ))}
    </div>
  )
}
