import type { ReactNode } from 'react'
import { CloseButton } from '@/components/CloseButton'
import { ThemeToggle } from '@/components/ThemeToggle'

export function TopBar({
  title,
  subtitle,
  close = true,
  children,
}: {
  title?: string
  subtitle?: string
  close?: boolean
  children?: ReactNode
}) {
  return (
    <header className="flex items-center justify-between gap-4 mb-6">
      <div className="min-w-0">
        {title && <h1 className="text-2xl font-semibold text-ink truncate">{title}</h1>}
        {subtitle && <p className="text-subtle text-sm">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {children}
        <ThemeToggle />
        {close && <CloseButton />}
      </div>
    </header>
  )
}
