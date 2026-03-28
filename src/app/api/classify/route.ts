import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const { emailText, from } = await req.json()

  if (!emailText) {
    return Response.json({ error: 'emailText is required' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  const client = new Anthropic({ apiKey })

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: `You classify emails as cold sales/marketing pitches or not. Consider:
- Unsolicited outreach selling a product or service = cold pitch
- Follow-ups to previous cold pitches = cold pitch
- Newsletters, receipts, notifications, personal emails, team communications = NOT cold pitch
- Recruiting/job offers = NOT cold pitch (unless selling recruiting services)

Respond with ONLY valid JSON, no other text:
{"isColdPitch": true/false, "confidence": 0.0-1.0, "reason": "brief one-line reason"}`,
      messages: [{
        role: 'user',
        content: `From: ${from || 'unknown'}\n\nEmail body:\n${emailText.substring(0, 2000)}`
      }],
    })

    const text = message.content.find(b => b.type === 'text')
    const raw = text && 'text' in text ? text.text : '{}'

    // Parse JSON, handling potential markdown wrapping
    const jsonStr = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
    const result = JSON.parse(jsonStr)

    return Response.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Classification failed'
    return Response.json({ error: msg }, { status: 500 })
  }
}
