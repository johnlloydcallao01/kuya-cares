import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '')
const AUTH_COOKIE = 'kuyacares-token'

async function proxy(request: NextRequest, method: 'GET' | 'POST') {
  const token = (await cookies()).get(AUTH_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  try {
    const body = method === 'POST' ? await request.text() : undefined
    if (method === 'POST' && !body) {
      return NextResponse.json({ error: 'Request body is required' }, { status: 400 })
    }
    const query = method === 'GET' ? new URL(request.url).search : ''
    const response = await fetch(`${CMS_BASE}/vendor/withdrawal-requests${query}`, {
      method,
      headers: {
        Authorization: `JWT ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(request.headers.has('Idempotency-Key')
          ? { 'Idempotency-Key': request.headers.get('Idempotency-Key')! }
          : {}),
      },
      ...(body !== undefined ? { body } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
    const responseBody = await response.text()
    return new NextResponse(responseBody, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
    })
  } catch (error) {
    console.error(`[web vendor withdrawals] ${method} request failed:`, error)
    return NextResponse.json({ error: 'Failed to reach the payout service' }, { status: 502 })
  }
}

export async function GET(request: NextRequest) {
  return proxy(request, 'GET')
}

export async function POST(request: NextRequest) {
  return proxy(request, 'POST')
}