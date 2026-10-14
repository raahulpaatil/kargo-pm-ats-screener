'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogoMark, Wordmark } from '@/components/crt/Logo'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      setError('ACCESS DENIED. Incorrect password.')
    }
  }

  return (
    <main id="main" className="min-h-svh flex items-center justify-center bg-black p-3 sm:p-6">
      <div
        className="crt-power-on relative w-full max-w-4xl min-h-[min(40rem,90svh)] rounded-[clamp(18px,4vw,44px)] bg-brand text-brand-ink flex flex-col items-center justify-center px-6 py-12"
        style={{ boxShadow: 'inset 0 0 120px rgba(0,0,0,0.55), inset 0 0 18px rgba(0,0,0,0.6), 0 0 80px rgba(107,47,42,0.35)' }}
      >
        <div className="flex items-center gap-4 mb-4">
          <LogoMark className="w-12 h-12 sm:w-16 sm:h-16" />
          <Wordmark className="text-5xl sm:text-7xl text-glow" />
        </div>
        <p className="pixel text-xl sm:text-2xl mb-12">Resume Screener, Version 2.0</p>

        <form onSubmit={handleSubmit} className="w-full max-w-md">
          <label htmlFor="password" className="pixel text-xl sm:text-2xl block mb-2">
            C:\KARGO&gt; ENTER PASSWORD<span className="blink" aria-hidden="true">_</span>
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'password-error' : undefined}
            className="pixel w-full bg-black/35 text-brand-ink text-2xl border-2 border-brand-ink/80 rounded-sm px-4 py-2 mb-3 focus:outline-none focus:border-brand-ink focus:bg-black/50"
            autoFocus
          />
          {error && (
            <p id="password-error" role="alert" className="pixel text-xl text-[#ffd2c4] mb-3">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="pixel w-full bg-brand-ink text-brand text-2xl rounded-sm py-2 hover:bg-white transition-colors disabled:opacity-60 cursor-pointer"
          >
            {loading ? 'VERIFYING…' : '[ CONTINUE ]'}
          </button>
        </form>

        <p className="pixel text-lg mt-12 opacity-80 text-center">Authorized Kargo hiring staff only.</p>
      </div>
    </main>
  )
}
