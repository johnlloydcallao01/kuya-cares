import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '')

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
const rateLimitHits = new Map<string, number[]>()

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const hits = (rateLimitHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (hits.length >= RATE_LIMIT_MAX) {
    rateLimitHits.set(ip, hits)
    return true
  }
  hits.push(now)
  rateLimitHits.set(ip, hits)
  return false
}

export async function POST(request: NextRequest) {
  if (isRateLimited(getClientIp(request))) {
    return NextResponse.json({ error: 'Too many registration attempts. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const idempotencyKey = request.headers.get('Idempotency-Key') ?? request.headers.get('idempotency-key')
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

    const res = await fetch(`${CMS_BASE}/vendor/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 })
  }
}
