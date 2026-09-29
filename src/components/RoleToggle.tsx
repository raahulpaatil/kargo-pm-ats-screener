'use client'

import type { Role } from '@/lib/rubric'

export function RoleToggle({ role, onChange }: { role: Role; onChange: (role: Role) => void }) {
  return (
    <div className="inline-flex bg-surface border border-line rounded-lg p-1">
      {(['PM', 'SPM'] as const).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            role === r ? 'bg-canvas text-ink shadow-soft' : 'text-subtle'
          }`}
        >
          {r === 'PM' ? 'Product Manager' : 'Senior Product Manager'}
        </button>
      ))}
    </div>
  )
}
