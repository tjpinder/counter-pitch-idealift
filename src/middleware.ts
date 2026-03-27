import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow login page and auth API through
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // API routes accept either cookie auth or x-api-key header
  if (pathname.startsWith('/api/')) {
    const headerKey = req.headers.get('x-api-key')
    if (headerKey && headerKey === process.env.SITE_API_KEY) {
      return NextResponse.next()
    }
    const token = req.cookies.get('cp-auth')?.value
    if (token === process.env.SITE_PASSWORD) {
      return NextResponse.next()
    }
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Page routes use cookie auth
  const token = req.cookies.get('cp-auth')?.value
  if (token !== process.env.SITE_PASSWORD) {
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
