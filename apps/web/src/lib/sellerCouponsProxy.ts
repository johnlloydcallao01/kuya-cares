import { NextRequest, NextResponse } from 'next/server'

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '')

async function getToken(request: NextRequest) {
  const token = request.cookies.get('kuyacares-token')?.value
  if (!token) return { token: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  try {
    const response = await fetch(`${CMS_BASE}/users/me?depth=0`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    })
    if (!response.ok) return { token: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    const user = (await response.json())?.user
    if (!user || user.role !== 'member') {
      return { token: null, error: NextResponse.json({ error: 'Member access required' }, { status: 403 }) }
    }
    return { token, error: null }
  } catch {
    return { token: null, error: NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 }) }
  }
}

async function forward(request: NextRequest, path: string, params?: { id?: string; usage?: boolean }) {
  const { token, error } = await getToken(request)
  if (error || !token) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const vendorId = request.nextUrl.searchParams.get('vendorId')
  let body: Record<string, unknown> | undefined
  if (request.method !== 'GET' && request.method !== 'DELETE') {
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
  }
  const selectedVendorId = vendorId || (typeof body?.vendorId === 'string' ? body.vendorId : '')
  if (!selectedVendorId) return NextResponse.json({ error: 'vendorId is required' }, { status: 400 })
  if (body) body.vendorId = selectedVendorId

  const query = new URLSearchParams({ vendorId: selectedVendorId })
  if (!params?.id && !params?.usage) {
    for (const key of ['search', 'sort', 'page', 'limit', 'status', 'discount_type']) {
      const value = request.nextUrl.searchParams.get(key)
      if (value) query.set(key, value)
    }
  } else if (params?.usage) {
    for (const key of ['couponId', 'orderId', 'customerId', 'status', 'page', 'limit']) {
      const value = request.nextUrl.searchParams.get(key)
      if (value) query.set(key, value)
    }
  }

  const url = `${CMS_BASE}${path}${params?.id ? `/${encodeURIComponent(params.id)}` : ''}${params?.usage ? '/redemptions' : ''}?${query}`
  try {
    const response = await fetch(url, {
      method: request.method,
      headers: {
        Authorization: `JWT ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
    const text = await response.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: text || 'CMS returned an invalid response' }
    }
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 })
  }
}

export function proxySellerCoupons(request: NextRequest) {
  return forward(request, '/vendor/coupons')
}

export function proxySellerCoupon(request: NextRequest, id: string) {
  return forward(request, '/vendor/coupons', { id })
}

export function proxySellerCouponUsage(request: NextRequest) {
  return forward(request, '/vendor/coupons', { usage: true })
}
