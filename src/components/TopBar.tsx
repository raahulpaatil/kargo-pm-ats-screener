import type { ReactNode } from 'react'
import Link from 'next/link'
import { CloseButton } from '@/components/CloseButton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { LogoMark, Wordmark } from '@/components/crt/Logo'

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
    <>
      <header className="flex items-center justify-between gap-4 mb-8">
        <Link href="/" className="flex items-center gap-2 text-ink shrink-0" aria-label="Kargo Resume Screener home">
          <LogoMark className="w-7 h-7" />
          <Wordmark className="text-2xl text-glow" />
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          {children}
          <ThemeToggle />
          {close && <CloseButton />}
        </div>
      </header>
      {(title || subtitle) && (
        <div className="mb-8">
          {title && <h1 className="text-4xl sm:text-5xl font-semibold text-ink text-glow leading-tight">{title}</h1>}
          {subtitle && <p className="pixel text-xl text-subtle mt-2">{subtitle}</p>}
        </div>
      )}
    </>
  )
}

// Text link styled as a DOS prompt command, used in top bars.
export function PromptLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="pixel text-lg text-accent hover:text-ink transition-colors mr-1 px-2 py-1 whitespace-nowrap"
    >
      <span aria-hidden="true">&gt; </span>
      {children}
    </Link>
  )
}
