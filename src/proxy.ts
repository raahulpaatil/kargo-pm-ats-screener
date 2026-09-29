import { NextRequest, NextResponse } from 'next/server'
import { isValidSessionCookieValue, SESSION_COOKIE_NAME } from '@/lib/auth'

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname === '/login' || pathname === '/api/auth') {
    return NextResponse.next()
  }

  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (isValidSessionCookieValue(cookie)) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.redirect(new URL('/login', req.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
