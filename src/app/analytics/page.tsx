'use client'

import { useState, useEffect } from 'react'

interface Analytics {
  total: number
  thisWeek: number
  thisMonth: number
  autoSent: number
  topDomains: { domain: string; count: number }[]
  levels: Record<string, number>
  sources: Record<string, number>
  recent: {
    timestamp: string
    senderName: string
    senderCompany: string
    senderDomain: string
    level: number
    pitchCount: number
    autoSent: boolean
    source: string
  }[]
}

const LEVEL_COLORS: Record<number, string> = { 1: '#c8f135', 2: '#ff9500', 3: '#ff4545' }
const LEVEL_NAMES: Record<number, string> = { 1: 'Real', 2: 'Chaos', 3: 'Unhinged' }

export default function AnalyticsDashboard() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', fontFamily: "'DM Mono', monospace" }}>
        <p style={{ color: '#888', fontSize: 12 }}>Loading...</p>
      </div>
    )
  }

  if (!data) return null

  const cardStyle = {
    background: '#111', border: '1px solid #222', borderRadius: 4, padding: 20, textAlign: 'center' as const,
  }
  const statNum = { fontSize: 28, fontWeight: 800, fontFamily: "'Syne', sans-serif" }
  const statLabel = { fontSize: 10, color: '#888', textTransform: 'uppercase' as const, letterSpacing: 2, marginTop: 4 }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 20px', fontFamily: "'DM Mono', monospace" }}>
      <a href="/" style={{ fontSize: 11, color: '#888', textDecoration: 'none', textTransform: 'uppercase', letterSpacing: 2 }}>&larr; Back</a>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: '#c8f135', margin: '16px 0 8px' }}>
        ANALYTICS
      </h1>
      <p style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 32 }}>
        Counter-pitch operations overview
      </p>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <div style={cardStyle}>
          <div style={{ ...statNum, color: '#c8f135' }}>{data.total}</div>
          <div style={statLabel}>Total Pitches</div>
        </div>
        <div style={cardStyle}>
          <div style={{ ...statNum, color: '#e8e8e8' }}>{data.thisWeek}</div>
          <div style={statLabel}>This Week</div>
        </div>
        <div style={cardStyle}>
          <div style={{ ...statNum, color: '#e8e8e8' }}>{data.thisMonth}</div>
          <div style={statLabel}>This Month</div>
        </div>
        <div style={cardStyle}>
          <div style={{ ...statNum, color: '#ff4545' }}>{data.autoSent}</div>
          <div style={statLabel}>Auto-Sent</div>
        </div>
      </div>

      {/* Level + Source distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
        <div style={{ ...cardStyle, textAlign: 'left' as const }}>
          <div style={{ ...statLabel, marginBottom: 12, marginTop: 0 }}>Chaos Distribution</div>
          {[1, 2, 3].map(level => {
            const count = data.levels[level] || 0
            const pct = data.total > 0 ? Math.round((count / data.total) * 100) : 0
            return (
              <div key={level} style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: LEVEL_COLORS[level], width: 65 }}>{LEVEL_NAMES[level]}</span>
                <div style={{ flex: 1, height: 8, background: '#0a0a0a', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: LEVEL_COLORS[level], borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 11, color: '#888', width: 30, textAlign: 'right' }}>{count}</span>
              </div>
            )
          })}
        </div>

        <div style={{ ...cardStyle, textAlign: 'left' as const }}>
          <div style={{ ...statLabel, marginBottom: 12, marginTop: 0 }}>Source</div>
          {Object.entries(data.sources).map(([source, count]) => (
            <div key={source} style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#e8e8e8' }}>{source}</span>
              <span style={{ fontSize: 11, color: '#888' }}>{count}</span>
            </div>
          ))}
          {Object.keys(data.sources).length === 0 && (
            <p style={{ fontSize: 11, color: '#555' }}>No data yet</p>
          )}
        </div>
      </div>

      {/* Top domains */}
      {data.topDomains.length > 0 && (
        <div style={{ ...cardStyle, textAlign: 'left' as const, marginBottom: 24 }}>
          <div style={{ ...statLabel, marginBottom: 12, marginTop: 0 }}>Top Offending Domains</div>
          {data.topDomains.map(({ domain, count }) => (
            <div key={domain} style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#e8e8e8' }}>{domain}</span>
              <span style={{ fontSize: 12, color: '#888' }}>{count} pitch{count !== 1 ? 'es' : ''}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent */}
      {data.recent.length > 0 && (
        <div style={{ ...cardStyle, textAlign: 'left' as const }}>
          <div style={{ ...statLabel, marginBottom: 12, marginTop: 0 }}>Recent Activity</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
                <th style={{ textAlign: 'left', paddingBottom: 8 }}>Sender</th>
                <th style={{ textAlign: 'left', paddingBottom: 8 }}>Level</th>
                <th style={{ textAlign: 'left', paddingBottom: 8 }}>Source</th>
                <th style={{ textAlign: 'right', paddingBottom: 8 }}>When</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((event, i) => (
                <tr key={i} style={{ borderTop: '1px solid #1a1a1a' }}>
                  <td style={{ padding: '6px 0', color: '#e8e8e8' }}>
                    {event.senderName}{event.autoSent ? ' (auto)' : ''}
                  </td>
                  <td style={{ padding: '6px 0', color: LEVEL_COLORS[event.level] }}>
                    {LEVEL_NAMES[event.level]}
                  </td>
                  <td style={{ padding: '6px 0', color: '#888' }}>{event.source}</td>
                  <td style={{ padding: '6px 0', color: '#555', textAlign: 'right' }}>
                    {new Date(event.timestamp).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
