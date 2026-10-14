'use client'

import { useSyncExternalStore } from 'react'

export type Theme = 'dark' | 'light'

function readTheme(): Theme {
  const explicit = document.documentElement.getAttribute('data-theme')
  if (explicit === 'light' || explicit === 'dark') return explicit
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function subscribe(cb: () => void) {
  const observer = new MutationObserver(cb)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  const media = window.matchMedia('(prefers-color-scheme: light)')
  media.addEventListener('change', cb)
  return () => {
    observer.disconnect()
    media.removeEventListener('change', cb)
  }
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => 'dark' as Theme)
}

function subscribeReducedMotion(cb: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  media.addEventListener('change', cb)
  return () => media.removeEventListener('change', cb)
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false
  )
}
