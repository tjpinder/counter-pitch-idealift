import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { buildPrompts } from '@/lib/prompt'
import { scrapeWebsite } from '@/lib/scraper'
import { trackPitch } from '@/lib/data'
import { sendDiscordNotification } from '@/lib/discord'

export async function POST(req: NextRequest) {
  const {
    senderName, senderCompany, websiteUrl, emailText, pitchCount,
    chaosOverride,
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
    chaosOverride, websiteContext,
  })

  // Track analytics
  const senderDomain = (websiteUrl || '').replace(/https?:\/\//, '').replace(/\/.*/, '') || senderCompany?.toLowerCase() || ''
  trackPitch({
    senderName: senderName || 'Unknown',
    senderCompany: senderCompany || 'Unknown',
    senderDomain,
    level,
    pitchCount: pitchCount || 1,
    autoSent: false,
    source: 'web',
  })

  const encoder = new TextEncoder()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'level', level })}\n\n`))

        const stream = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
          stream: true,
        })

        let fullText = ''
        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            fullText += event.delta.text
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`)
            )
          }
        }

        // Discord notification after stream completes
        const delimIdx = fullText.indexOf('\n---\n')
        let subject = ''
        if (delimIdx !== -1) {
          const header = fullText.substring(0, delimIdx)
          const match = header.match(/SUBJECT:\s*(.+)/i)
          if (match) subject = match[1].trim()
        }

        sendDiscordNotification({
          senderName: senderName || 'Unknown',
          senderCompany: senderCompany || 'Unknown',
          level,
          pitchCount: pitchCount || 1,
          subject,
          source: 'web',
          autoSent: false,
        }).catch(() => {})

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Anthropic API error'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
