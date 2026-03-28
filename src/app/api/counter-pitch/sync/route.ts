import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildPrompts, parseResponse } from '@/lib/prompt'
import { scrapeWebsite } from '@/lib/scraper'
import { trackPitch } from '@/lib/data'
import { sendDiscordNotification } from '@/lib/discord'

export async function POST(req: NextRequest) {
  const {
    senderName, senderCompany, websiteUrl, emailText, pitchCount,
    chaosOverride, threadMessages, source, autoSent,
  } = await req.json()

  if (!emailText) {
    return Response.json({ error: 'emailText is required' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  // Scrape sender's website for context
  const websiteContext = await scrapeWebsite(websiteUrl || '')

  const client = new Anthropic({ apiKey })
  const { systemPrompt, userPrompt, level } = buildPrompts({
    senderName, senderCompany, websiteUrl, emailText, pitchCount,
    chaosOverride, websiteContext, threadMessages,
  })

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const text = message.content.find(b => b.type === 'text')
    const fullText = text && 'text' in text ? text.text : ''
    const { subject, body } = parseResponse(fullText)

    // Extract domain from sender company or email
    const senderDomain = (websiteUrl || '').replace(/https?:\/\//, '').replace(/\/.*/, '') || senderCompany?.toLowerCase() || ''

    // Track analytics
    trackPitch({
      senderName: senderName || 'Unknown',
      senderCompany: senderCompany || 'Unknown',
      senderDomain,
      level,
      pitchCount: pitchCount || 1,
      autoSent: autoSent || false,
      source: source || 'web',
    })

    // Discord notification
    sendDiscordNotification({
      senderName: senderName || 'Unknown',
      senderCompany: senderCompany || 'Unknown',
      level,
      pitchCount: pitchCount || 1,
      subject,
      source: source || 'web',
      autoSent: autoSent || false,
    }).catch(() => {})

    return Response.json({ subject, body, level })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Anthropic API error'
    return Response.json({ error: msg }, { status: 500 })
  }
}
