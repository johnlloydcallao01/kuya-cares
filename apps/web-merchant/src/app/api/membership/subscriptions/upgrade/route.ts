import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '')
const AUTH_COOKIE = 'kuyacares-merchant-token'

async function authenticateVendorProxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return { token: null, user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  try {
    const meRes = await fetch(`${CMS_BASE}/users/me?depth=2`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
    })
    if (!meRes.ok) return { token: null, user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    const me = await meRes.json()
    const user = me?.user
    if (!user || user.role !== 'vendor') {
      return { token: null, user: null, error: NextResponse.json({ error: 'Vendor access required' }, { status: 403 }) }
    }
    return { token, user, error: null }
  } catch {
    return { token: null, user: null, error: NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 }) }
  }
}

export async function POST(request: NextRequest) {
  const { token, user, error } = await authenticateVendorProxy(request)
  if (error) return error
  if (!token || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    delete body.vendorId
    delete body.vendor
    if (body.idempotencyKey == null || body.idempotencyKey === '') {
      body.idempotencyKey = crypto.randomUUID()
    }
    const headers: Record<string, string> = {
      Authorization: `JWT ${token}`,
      'Content-Type': 'application/json',
    }
    const idempotencyHeader = request.headers.get('Idempotency-Key') ?? request.headers.get('idempotency-key')
    if (idempotencyHeader) headers['Idempotency-Key'] = idempotencyHeader

    const res = await fetch(`${CMS_BASE}/vendor/subscriptions/upgrade`, {
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
