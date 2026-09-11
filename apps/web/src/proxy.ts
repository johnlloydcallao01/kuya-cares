import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api'
const COLLECTION_SLUG = 'users'


const AUTH_ROUTES = ['/signin', '/register', '/forgot-password']

const PUBLIC_ROUTES = [
  '/api',
  '/_next',
  '/favicon.ico',
  '/logo.png',
  '/file.svg',
  '/globe.svg',
  '/next.svg',
  '/vercel.svg',
  '/window.svg'
]

function matchesPath(pathname: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    if (pattern.endsWith('*')) {
      return pathname.startsWith(pattern.slice(0, -1))
    }
    return pathname === pattern || pathname.startsWith(pattern + '/')
  })
}


export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (matchesPath(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/') && !pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  if (matchesPath(pathname, AUTH_ROUTES)) {
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'
  ],
}

export async function withAuth(_handler: (request: NextRequest) => Promise<NextResponse>) {
  return async (_request: NextRequest) => {
    return NextResponse.json(
      { error: 'Server-side auth check not available in this configuration' },
      { status: 501 }
    )
  }
}

export function withRole(roles: string[]) {
  return (handler: (request: NextRequest) => Promise<NextResponse>) => {
    return async (request: NextRequest) => {
      try {
        const response = await fetch(`${API_BASE_URL}/${COLLECTION_SLUG}/me`, {
          method: 'GET',
          headers: {
            'Cookie': request.headers.get('cookie') || '',
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        })

        if (!response.ok) {
          return NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 }
          )
        }

        const data = await response.json()
        const user = (data as any).user

        if (!user || !roles.includes(user.role)) {
          return NextResponse.json(
            { error: 'Forbidden' },
            { status: 403 }
          )
        }

        return handler(request)
      } catch {
        return NextResponse.json(
          { error: 'Authentication check failed' },
          { status: 500 }
        )
      }
    }
  }
}
