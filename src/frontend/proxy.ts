import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Proxy (previously "middleware") — protects all routes except:
 * - /api/auth/... (next-auth internal routes)
 * - /login       (sign-in page)
 * - /public/...  (anonymous public pages, e.g. public series landing)
 * - Next.js static files and image optimisation
 * - favicon
 */
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow auth, login, and public routes through unconditionally
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/about') ||
    (pathname === '/public' || pathname.startsWith('/public/')) ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token) {
    const signIn = new URL('/api/auth/signin', req.url)
    signIn.searchParams.set('callbackUrl', req.url)
    return NextResponse.redirect(signIn)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api/auth|login|public|_next/static|_next/image|favicon\\.ico).*)',
  ],
}
