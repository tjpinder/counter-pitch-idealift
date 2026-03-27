export function buildPrompts(params: {
  senderName: string
  senderCompany: string
  websiteUrl: string
  emailText: string
  pitchCount: number
}) {
  const { senderName, senderCompany, websiteUrl, emailText, pitchCount } = params
  const level: 1 | 2 | 3 = pitchCount <= 1 ? 1 : pitchCount === 2 ? 2 : 3

  const chaosInstruction =
    level === 1
      ? `Pitch one of IdeaLift's services straight -- whichever is the best counter-punch to what the sender is selling. This is pitch #1 from this person.`
      : level === 2
        ? `This is pitch #${pitchCount} from this person -- they came back. Still counter-pitch with a real IdeaLift service, but ALSO mix in one completely absurd fake service Tom offers. IMPORTANT: Invent a brand new absurd service from scratch every time. It MUST be thematically related to whatever the sender is pitching -- riff on their industry, their product category, their jargon. If they sell SEO, the fake service should twist SEO into something unhinged. If they sell design, make it about design. Never reuse the same fake service twice. The more specific to their pitch and the more confidently deadpan, the funnier. Tom never breaks character. Still end with something real about IdeaLift.`
        : `This is pitch #${pitchCount} from this person -- they will not stop. Go full chaos. Tom now offers increasingly unhinged services alongside the real IdeaLift ones. IMPORTANT: Invent 3-4 brand new absurd services from scratch. Each one MUST riff on the sender's specific industry, product, or jargon -- twist what they're selling into something completely unhinged. If they sell analytics, make it about absurd analytics. If they sell recruiting, make it about absurd recruiting. Never reuse fake services from previous responses. Each service should sound hyper-specific, use confident metrics and pricing, and be delivered completely deadpan. Stack them alongside the real services naturally. Tom treats them all as equally legitimate. Still close with a real IdeaLift service and idealift.app.`

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

  return { systemPrompt, userPrompt, level }
}

export function parseResponse(text: string): { subject: string; body: string } {
  const delimIdx = text.indexOf('\n---\n')
  if (delimIdx !== -1) {
    const header = text.substring(0, delimIdx)
    const body = text.substring(delimIdx + 5).trim()
    const match = header.match(/SUBJECT:\s*(.+)/i)
    return { subject: match ? match[1].trim() : '', body }
  }
  return { subject: '', body: text.trim() }
}
