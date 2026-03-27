'use client'

import { useState, useRef, useEffect } from 'react'
import styles from './page.module.css'

const CHAOS_LEVELS: Record<1 | 2 | 3, { label: string; cls: string }> = {
  1: { label: 'REAL MODE', cls: styles.chaos1 },
  2: { label: 'CHAOS MODE', cls: styles.chaos2 },
  3: { label: 'UNHINGED MODE', cls: styles.chaos3 },
}

export default function Home() {
  const [senderName, setSenderName] = useState('')
  const [senderCompany, setSenderCompany] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [emailText, setEmailText] = useState('')
  const [output, setOutput] = useState('')
  const [subjectLine, setSubjectLine] = useState('')
  const [loading, setLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')
  const [chaosLevel, setChaosLevel] = useState<1 | 2 | 3>(1)
  const [pitchCount, setPitchCount] = useState(0)
  const [copied, setCopied] = useState(false)

  const pitchLog = useRef<Record<string, number>>({})
  const outputRef = useRef<HTMLDivElement>(null)

  function getSenderKey() {
    return `${senderName}|${senderCompany}`.toLowerCase().trim() || 'unknown'
  }

  async function generate() {
    if (!emailText.trim()) {
      setError('Paste their email first.')
      return
    }

    setError('')
    setLoading(true)
    setStreaming(true)
    setOutput('')
    setSubjectLine('')

    const key = getSenderKey()
    pitchLog.current[key] = (pitchLog.current[key] || 0) + 1
    const count = pitchLog.current[key]
    setPitchCount(count)

    try {
      const res = await fetch('/api/counter-pitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderName, senderCompany, websiteUrl, emailText, pitchCount: count }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Something went wrong')
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''
      let subjectParsed = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'level') {
              setChaosLevel(data.level as 1 | 2 | 3)
            } else if (data.type === 'text') {
              fullText += data.text

              const delimIdx = fullText.indexOf('\n---\n')
              if (delimIdx !== -1 && !subjectParsed) {
                subjectParsed = true
                const header = fullText.substring(0, delimIdx)
                const match = header.match(/SUBJECT:\s*(.+)/i)
                if (match) setSubjectLine(match[1].trim())
              }

              if (subjectParsed) {
                const delimIdx2 = fullText.indexOf('\n---\n')
                const body = fullText.substring(delimIdx2 + 5).trimStart()
                setOutput(body)
              }
            } else if (data.type === 'error') {
              throw new Error(data.error)
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }

      if (!subjectParsed && fullText) {
        setOutput(fullText)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      setStreaming(false)
    }
  }

  function copyAll() {
    const full = subjectLine ? `Subject: ${subjectLine}\n\n${output}` : output
    navigator.clipboard.writeText(full).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  useEffect(() => {
    if (streaming && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output, streaming])

  const chaos = CHAOS_LEVELS[chaosLevel]

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.h1}>COUNTER PITCH</h1>
        <p className={styles.subtitle}>They pitch you. Tom pitches back harder.</p>
        <div className={styles.serviceBar}>
          <span className={styles.serviceTag}>Decision Intelligence</span>
          <span className={styles.serviceTag}>Website Redesigns</span>
          <span className={styles.serviceTag}>CRO</span>
          <span className={styles.serviceTag}>AI Automation</span>
        </div>
      </header>

      <div className={styles.card}>
        <div className={styles.row}>
          <div>
            <label className={styles.label}>Sender Name</label>
            <input className={styles.input} value={senderName} onChange={e => setSenderName(e.target.value)} placeholder="e.g. John Smith" />
          </div>
          <div>
            <label className={styles.label}>Their Company</label>
            <input className={styles.input} value={senderCompany} onChange={e => setSenderCompany(e.target.value)} placeholder="e.g. Acme Agency" />
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <label className={styles.label}>Their Website URL</label>
        <input className={styles.input} value={websiteUrl} onChange={e => setWebsiteUrl(e.target.value)} placeholder="https://theirsite.com" />
      </div>

      <div className={styles.card}>
        <label className={styles.label}>Their Email (paste the full thing)</label>
        <textarea className={styles.textarea} value={emailText} onChange={e => setEmailText(e.target.value)} placeholder="Paste their pitch email here..." />
      </div>

      <button className={styles.btn} onClick={generate} disabled={loading}>
        {loading ? <span className={styles.spinner} /> : null}
        {loading
          ? chaosLevel === 1 ? 'Analyzing...' : chaosLevel === 2 ? 'Warming up chaos...' : 'Entering the void...'
          : 'FIRE BACK'}
      </button>

      {error && <p className={styles.error}>{error}</p>}

      {(output || streaming) && (
        <div className={styles.outputSection}>
          <p className={styles.outputLabel}>
            Your Counter Pitch
            <span className={`${styles.chaosBadge} ${chaos.cls}`}>{chaos.label}</span>
          </p>

          {subjectLine && (
            <div className={styles.subjectBox}>
              <span className={styles.subjectLabel}>SUBJECT:</span>
              <span className={styles.subjectText}>{subjectLine}</span>
            </div>
          )}

          <div className={styles.outputBox} ref={outputRef}>
            {output}
            {streaming && <span className={styles.cursor}>|</span>}
          </div>

          {!streaming && output && (
            <>
              <button className={styles.copyBtn} onClick={copyAll}>
                {copied ? '[ COPIED ]' : '[ COPY TO CLIPBOARD ]'}
              </button>
              <p
                className={styles.chaosMeter}
                style={{ color: chaosLevel === 1 ? 'var(--accent)' : chaosLevel === 2 ? '#ff9500' : 'var(--danger)' }}
              >
                {`Pitch #${pitchCount} from this sender  ${'\u2588'.repeat(Math.min(pitchCount, 10))}`}
              </p>
            </>
          )}
        </div>
      )}

      <footer className={styles.footer}>
        <a href="https://idealift.app" target="_blank" rel="noopener noreferrer" className={styles.footerLink}>idealift.app</a>
      </footer>
    </div>
  )
}
