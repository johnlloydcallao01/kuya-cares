import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const allowedOrigins = [
  process.env.ADMIN_PROD_URL,
  process.env.ADMIN_LOCAL_URL,
  process.env.WEB_PROD_URL,
  process.env.WEB_LOCAL_URL,
  process.env.WEB_DRIVER_LOCAL_URL,
  process.env.MOBILE_CUSTOMER_LOCAL_URL,
  process.env.CMS_PROD_URL,
  process.env.CMS_LOCAL_URL,
].filter((v): v is string => typeof v === 'string' && v.length > 0)

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin')

    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 200 })

      if (origin && allowedOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin)
      }

      response.headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With')
      response.headers.set('Access-Control-Allow-Credentials', 'true')
      response.headers.set('Access-Control-Max-Age', '86400')

      return response
    }

    const response = NextResponse.next()

    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Access-Control-Allow-Credentials', 'true')
    }

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
