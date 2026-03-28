import { getAnalytics } from '@/lib/data'

export async function GET() {
  const events = getAnalytics()

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const thisWeek = events.filter(e => new Date(e.timestamp) >= weekAgo)
  const thisMonth = events.filter(e => new Date(e.timestamp) >= monthAgo)

  // Top domains
  const domainCounts: Record<string, number> = {}
  for (const e of events) {
    if (e.senderDomain) {
      domainCounts[e.senderDomain] = (domainCounts[e.senderDomain] || 0) + 1
    }
  }
  const topDomains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([domain, count]) => ({ domain, count }))

  // Level distribution
  const levels = { 1: 0, 2: 0, 3: 0 }
  for (const e of events) {
    levels[e.level] = (levels[e.level] || 0) + 1
  }

  // Source distribution
  const sources: Record<string, number> = {}
  for (const e of events) {
    sources[e.source] = (sources[e.source] || 0) + 1
  }

  // Auto-sent count
  const autoSentCount = events.filter(e => e.autoSent).length

  return Response.json({
    total: events.length,
    thisWeek: thisWeek.length,
    thisMonth: thisMonth.length,
    autoSent: autoSentCount,
    topDomains,
    levels,
    sources,
    recent: events.slice(0, 25),
  })
}
