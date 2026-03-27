import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const { password } = await req.json()

  if (!password || password !== process.env.SITE_PASSWORD) {
    return Response.json({ error: 'Wrong password' }, { status: 401 })
  }

  const res = Response.json({ ok: true })
  res.headers.set(
    'Set-Cookie',
    `cp-auth=${password}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`
  )
  return res
}
