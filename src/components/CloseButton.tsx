'use client'

import { useRouter } from 'next/navigation'

export function CloseButton({ fallbackHref = '/candidates' }: { fallbackHref?: string }) {
  const router = useRouter()

  function close() {
    if (window.history.length > 1) router.back()
    else router.push(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={close}
      aria-label="Close and go back"
      className="w-10 h-10 rounded-full bg-surface border border-line text-subtle hover:text-ink transition flex items-center justify-center"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  )
}
