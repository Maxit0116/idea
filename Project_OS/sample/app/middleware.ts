import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/dashboard', '/profile', '/settings', '/notifications', '/admin', '/checkout']

export function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value
  const isProtected = PROTECTED_PATHS.some((p) => request.nextUrl.pathname.startsWith(p))

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (request.nextUrl.pathname.startsWith('/admin')) {
    // Admin check would validate role here
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
