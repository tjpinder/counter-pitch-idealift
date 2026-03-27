import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(req: NextRequest) {
  const { senderName, senderCompany, websiteUrl, emailText, pitchCount } = await req.json()

  if (!emailText) {
    return Response.json({ error: 'emailText is required' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  const client = new Anthropic({ apiKey })
  const level: 1 | 2 | 3 = pitchCount <= 1 ? 1 : pitchCount === 2 ? 2 : 3

  const chaosInstruction =
    level === 1
      ? `Pitch one of IdeaLift's services straight -- whichever is the best counter-punch to what the sender is selling. This is pitch #1 from this person.`
      : level === 2
        ? `This is pitch #${pitchCount} from this person -- they came back. Still counter-pitch with a real IdeaLift service, but ALSO mix in one completely absurd fake service Tom offers. Examples: artisanal PowerPoint deck burning ceremonies, competitive napping coaching, enterprise-grade pigeon-based message routing, bespoke pixel-counting audits for websites that already look fine. Commit to the bit. Sound like a real offer. Tom never breaks character. Still end with something real about IdeaLift.`
        : `This is pitch #${pitchCount} from this person -- they will not stop. Go full chaos. Tom now offers increasingly unhinged services alongside the real IdeaLift ones. Examples: blockchain-certified goat yoga ROI audits, submarine-based Slack migration consulting, artisanal decision burndown rituals performed at dawn, enterprise-grade emotional support for Gantt charts, bespoke conversion rate optimization for websites that don't exist yet, AI workflow automation for your office plants. Stack multiple absurd services alongside the real ones. The more specific and confident, the funnier. Tom is completely deadpan. Still close with a real IdeaLift service and idealift.app.`

  const systemPrompt = `You are writing a counter-pitch reply email on behalf of Tom, founder of IdeaLift (idealift.app).

About IdeaLift -- Tom and the team offer a diverse range of services:

1. DECISION INTELLIGENCE PLATFORM (idealift.app): B2B SaaS that captures product decisions from Slack, Teams, Discord using ambient AI. No manual tagging. Preserves context through a human-approval workflow, syncs to Jira, Linear, GitHub, Azure DevOps. Core problem: "Decision Decay" -- decisions made in chat lose context and never reach execution. Costs Series A product teams (15-50 people) ~$49K/quarter.

2. WEBSITE REDESIGNS: Full website redesign services. Modern, conversion-focused builds. Not just making things pretty -- restructuring information architecture, user flows, and messaging to actually move the needle.

3. CRO SERVICES (Conversion Rate Optimization): Data-driven conversion optimization. A/B testing, funnel analysis, landing page optimization, user behavior analysis. Turning traffic into revenue instead of just vanity metrics.

4. AI WORKFLOW AUTOMATION: Building custom AI-powered workflows that replace manual processes. From internal ops to customer-facing features. Not chatbot slop -- actual useful automation that saves real hours.

Tom's voice: direct, dry, short sentences. No corporate fluff. Military clarity. Slightly abrasive edge. No em dashes. No "leverage," "synergy," "dive in," "at the end of the day." Deadpan humor -- he never winks at the joke. Confident but not arrogant. Talks like someone who has built things, not someone who talks about building things.

Task: ${chaosInstruction}

Format your response EXACTLY like this:
SUBJECT: [a punchy email subject line]
---
[the email body]

Keep the email body under 200 words. No formal sign-off block. End with a line that invites reply or action.`

  const userPrompt = `Inbound pitcher: ${senderName || 'Unknown'} from ${senderCompany || 'their company'}
Their website: ${websiteUrl || 'not provided'}
Pitch number from this person: ${pitchCount}

Their email:
---
${emailText}
---

Write Tom's counter-pitch reply.`

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

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'text', text: event.delta.text })}\n\n`)
            )
          }
        }

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
