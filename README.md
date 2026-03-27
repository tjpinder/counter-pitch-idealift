# Counter Pitch -- IdeaLift Edition

> They pitch you. Tom pitches back harder.

The IdeaLift-specific deployment of [Counter Pitch](https://github.com/tjpinder/counter-pitch). Paste a cold pitch email, get a counter-pitch for one of IdeaLift's services in seconds.

The longer they keep pitching, the more unhinged Tom's replies get.

![Counter Pitch](https://img.shields.io/badge/built_with-Next.js-black) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Services Tom will pitch

| Service | What it is |
|---|---|
| **Decision Intelligence Platform** | B2B SaaS -- captures product decisions from Slack/Teams/Discord via ambient AI, syncs to Jira/Linear/GitHub/Azure DevOps. Kills Decision Decay. |
| **Website Redesigns** | Conversion-focused redesigns. Information architecture, user flows, messaging that moves the needle. |
| **CRO Services** | Data-driven conversion rate optimization. A/B testing, funnel analysis, landing page optimization. |
| **AI Workflow Automation** | Custom AI-powered workflows replacing manual processes. Internal ops to customer-facing features. |

The AI picks whichever service is the best counter-punch to what the sender is selling.

---

## Chaos escalation

| Pitch # | Mode | What happens |
|---|---|---|
| 1 | REAL MODE | Straight counter-pitch with a real IdeaLift service |
| 2 | CHAOS MODE | Real service + one absurd fake service |
| 3+ | UNHINGED MODE | Multiple fake services. Fully deadpan. Still closes with something real. |

---

## Running locally

**Requirements:** Node 18+, an [Anthropic API key](https://console.anthropic.com/)

```bash
git clone https://github.com/tjpinder/counter-pitch-idealift.git
cd counter-pitch-idealift
npm install
cp .env.local.example .env.local
# Add your Anthropic API key to .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy

### Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/tjpinder/counter-pitch-idealift)

Add `ANTHROPIC_API_KEY` as an environment variable in your Vercel project settings.

---

## Want the generic version?

Use [counter-pitch](https://github.com/tjpinder/counter-pitch) to configure your own product, voice, and services.

---

## Stack

- [Next.js](https://nextjs.org/) -- App Router with streaming API routes
- [Anthropic Claude](https://anthropic.com/) -- Claude Sonnet via `@anthropic-ai/sdk`
- [idealift.app](https://idealift.app)

---

## License

MIT
