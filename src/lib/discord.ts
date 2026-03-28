export async function sendDiscordNotification(params: {
  senderName: string
  senderCompany: string
  level: 1 | 2 | 3
  pitchCount: number
  subject: string
  source: string
  autoSent: boolean
}): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL
  if (!webhookUrl) return

  const levelLabel = params.level === 1 ? 'REAL MODE' : params.level === 2 ? 'CHAOS MODE' : 'UNHINGED MODE'
  const color = params.level === 1 ? 0xc8f135 : params.level === 2 ? 0xff9500 : 0xff4545
  const action = params.autoSent ? 'AUTO-SENT' : 'Draft Created'

  const embed = {
    title: `Counter Pitch ${action}`,
    description: `**${params.senderName}** from **${params.senderCompany}**`,
    color,
    fields: [
      { name: 'Subject', value: params.subject || '(none)', inline: false },
      { name: 'Mode', value: levelLabel, inline: true },
      { name: 'Pitch #', value: String(params.pitchCount), inline: true },
      { name: 'Source', value: params.source, inline: true },
    ],
    footer: { text: 'Counter Pitch - IdeaLift' },
    timestamp: new Date().toISOString(),
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  }).catch(() => {})
}
