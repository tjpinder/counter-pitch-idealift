'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        setError('Wrong password.')
        return
      }

      router.push('/')
      router.refresh()
    } catch {
      setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      maxWidth: 400,
      margin: '120px auto',
      padding: '0 20px',
      fontFamily: "'DM Mono', monospace",
    }}>
      <h1 style={{
        fontFamily: "'Syne', sans-serif",
        fontSize: 28,
        fontWeight: 800,
        color: '#c8f135',
        marginBottom: 8,
      }}>
        COUNTER PITCH
      </h1>
      <p style={{
        fontSize: 11,
        color: '#888',
        textTransform: 'uppercase' as const,
        letterSpacing: 2,
        marginBottom: 32,
      }}>
        Password required
      </p>

      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Enter password"
          autoFocus
          style={{
            width: '100%',
            background: '#0a0a0a',
            border: '1px solid #222',
            borderRadius: 3,
            color: '#e8e8e8',
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            padding: '12px 14px',
            outline: 'none',
            marginBottom: 12,
            boxSizing: 'border-box' as const,
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 14,
            background: '#c8f135',
            color: '#0a0a0a',
            border: 'none',
            borderRadius: 3,
            fontFamily: "'Syne', sans-serif",
            fontSize: 15,
            fontWeight: 800,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.35 : 1,
          }}
        >
          {loading ? 'Checking...' : 'ENTER'}
        </button>
      </form>

      {error && (
        <p style={{ fontSize: 11, color: '#ff4545', marginTop: 10 }}>{error}</p>
      )}
    </div>
  )
}
