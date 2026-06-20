import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const session = request.cookies.get('didi_session')?.value
  const { pathname } = request.nextUrl

  // Public routes — no auth required
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth/')
  ) {
    return NextResponse.next()
  }

  if (session !== 'authenticated') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
