import { NextRequest } from 'next/server'
import { getHallOfFame, addToHallOfFame, removeFromHallOfFame } from '@/lib/data'

export async function GET() {
  const entries = getHallOfFame()
  return Response.json(entries)
}

export async function POST(req: NextRequest) {
  const { senderName, senderCompany, subject, body, level, pitchCount } = await req.json()

  if (!body) {
    return Response.json({ error: 'body is required' }, { status: 400 })
  }

  const entry = addToHallOfFame({
    senderName: senderName || 'Unknown',
    senderCompany: senderCompany || 'Unknown',
    subject: subject || '',
    body,
    level: level || 1,
    pitchCount: pitchCount || 1,
  })

  return Response.json(entry, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()

  if (!id) {
    return Response.json({ error: 'id is required' }, { status: 400 })
  }

  const removed = removeFromHallOfFame(id)
  if (!removed) {
    return Response.json({ error: 'Entry not found' }, { status: 404 })
  }

  return Response.json({ ok: true })
}
