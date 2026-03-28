'use client'

import { useState, useEffect } from 'react'

interface Entry {
  id: string
  timestamp: string
  senderName: string
  senderCompany: string
  subject: string
  body: string
  level: 1 | 2 | 3
  pitchCount: number
}

const LEVEL_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'REAL', color: '#c8f135', bg: '#1a2a00' },
  2: { label: 'CHAOS', color: '#ff9500', bg: '#2a1500' },
  3: { label: 'UNHINGED', color: '#ff4545', bg: '#2a0000' },
}

export default function HallOfFame() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/hall-of-fame')
      .then(r => r.json())
      .then(setEntries)
      .finally(() => setLoading(false))
  }, [])

  async function remove(id: string) {
    await fetch('/api/hall-of-fame', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', fontFamily: "'DM Mono', monospace" }}>
      <a href="/" style={{ fontSize: 11, color: '#888', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: 2 }}>&larr; Back</a>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: '#c8f135', margin: '16px 0 8px' }}>
        HALL OF FAME
      </h1>
      <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 32 }}>
        The greatest counter-pitches ever fired
      </p>

      {loading && <p style={{ color: '#888', fontSize: 12 }}>Loading...</p>}

      {!loading && entries.length === 0 && (
        <p style={{ color: '#888', fontSize: 12 }}>No entries yet. Fire back at someone and save it here.</p>
      )}

      {entries.map(entry => {
        const lvl = LEVEL_LABELS[entry.level]
        return (
          <div key={entry.id} style={{
            background: '#111', border: '1px solid #222', borderRadius: 4,
            padding: 24, marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <span style={{
                  fontSize: 10, textTransform: 'uppercase', letterSpacing: 2,
                  padding: '3px 8px', borderRadius: 2, fontFamily: "'DM Mono', monospace",
                  background: lvl.bg, color: lvl.color, border: `1px solid ${lvl.color}`,
                }}>{lvl.label}</span>
                <span style={{ fontSize: 11, color: '#888', marginLeft: 10 }}>
                  Pitch #{entry.pitchCount}
                </span>
              </div>
              <span style={{ fontSize: 10, color: '#555' }}>
                {new Date(entry.timestamp).toLocaleDateString()}
              </span>
            </div>

            <p style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
              vs. <strong style={{ color: '#e8e8e8' }}>{entry.senderName}</strong> from{' '}
              <strong style={{ color: '#e8e8e8' }}>{entry.senderCompany}</strong>
            </p>

            {entry.subject && (
              <p style={{ fontSize: 13, color: '#c8f135', fontWeight: 500, marginBottom: 12 }}>
                {entry.subject}
              </p>
            )}

            <div style={{
              fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              color: '#e8e8e8', background: '#0a0a0a', border: '1px solid #222',
              borderRadius: 3, padding: 16,
            }}>
              {entry.body}
            </div>

            <button
              onClick={() => remove(entry.id)}
              style={{
                marginTop: 8, background: 'none', border: 'none', color: '#555',
                fontSize: 10, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: 1,
              }}
            >Remove</button>
          </div>
        )
      })}
    </div>
  )
}
