import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'

function getDataDir(): string {
  // Azure App Service Linux uses /home for persistent storage
  if (process.env.WEBSITE_INSTANCE_ID) {
    return '/home/data'
  }
  return path.join(process.cwd(), 'data')
}

function ensureDir() {
  const dir = getDataDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function readJSON<T>(filename: string, fallback: T): T {
  ensureDir()
  const filepath = path.join(getDataDir(), filename)
  if (!existsSync(filepath)) return fallback
  try {
    return JSON.parse(readFileSync(filepath, 'utf-8'))
  } catch {
    return fallback
  }
}

function writeJSON<T>(filename: string, data: T): void {
  ensureDir()
  const filepath = path.join(getDataDir(), filename)
  writeFileSync(filepath, JSON.stringify(data, null, 2))
}

// ============================================================
// Hall of Fame
// ============================================================

export interface HallOfFameEntry {
  id: string
  timestamp: string
  senderName: string
  senderCompany: string
  subject: string
  body: string
  level: 1 | 2 | 3
  pitchCount: number
}

export function getHallOfFame(): HallOfFameEntry[] {
  return readJSON('hall-of-fame.json', [])
}

export function getHallOfFameEntry(id: string): HallOfFameEntry | undefined {
  return getHallOfFame().find(e => e.id === id)
}

export function addToHallOfFame(entry: Omit<HallOfFameEntry, 'id' | 'timestamp'>): HallOfFameEntry {
  const entries = getHallOfFame()
  const newEntry: HallOfFameEntry = {
    ...entry,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
  }
  entries.unshift(newEntry)
  writeJSON('hall-of-fame.json', entries)
  return newEntry
}

export function removeFromHallOfFame(id: string): boolean {
  const entries = getHallOfFame()
  const filtered = entries.filter(e => e.id !== id)
  if (filtered.length === entries.length) return false
  writeJSON('hall-of-fame.json', filtered)
  return true
}

// ============================================================
// Analytics
// ============================================================

export interface AnalyticsEvent {
  timestamp: string
  senderName: string
  senderCompany: string
  senderDomain: string
  level: 1 | 2 | 3
  pitchCount: number
  autoSent: boolean
  source: 'web' | 'gmail-auto' | 'gmail-addon'
}

export function getAnalytics(): AnalyticsEvent[] {
  return readJSON('analytics.json', [])
}

export function trackPitch(event: Omit<AnalyticsEvent, 'timestamp'>): void {
  const events = getAnalytics()
  events.unshift({ ...event, timestamp: new Date().toISOString() })
  // Keep last 1000 events
  if (events.length > 1000) events.length = 1000
  writeJSON('analytics.json', events)
}
