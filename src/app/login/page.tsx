'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

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
      setError('Incorrect password.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <form onSubmit={handleSubmit} className="bg-surface shadow-soft border border-line rounded-xl2 p-10 w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-ink mb-1">PM/SPM Screener</h1>
        <p className="text-subtle text-sm mb-6">Enter the password to continue.</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-canvas text-ink border border-line rounded-lg px-4 py-3 mb-3 focus:outline-none focus:ring-2 focus:ring-accent"
          placeholder="Password"
          autoFocus
        />
        {error && <p className="text-danger text-sm mb-3">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent text-on-solid rounded-lg py-3 font-medium hover:opacity-90 transition disabled:opacity-50"
        >
          {loading ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
