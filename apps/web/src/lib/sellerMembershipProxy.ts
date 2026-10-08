import { NextRequest, NextResponse } from 'next/server'

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '')
const AUTH_COOKIE = 'kuyacares-token'

type MembershipAction =
  | 'profiles'
  | 'plans'
  | 'subscription'
  | 'checkout'
  | 'upgrade'
  | 'downgrade'
  | 'cancel'
  | 'renew'
  | 'trial'
  | 'coupon'
  | 'invoices'
  | 'invoiceDetail'

const CMS_PATHS: Record<Exclude<MembershipAction, 'profiles' | 'plans' | 'subscription' | 'invoices' | 'invoiceDetail'>, string> = {
  checkout: '/vendor/subscriptions/checkout',
  upgrade: '/vendor/subscriptions/upgrade',
  downgrade: '/vendor/subscriptions/downgrade',
  cancel: '/vendor/subscriptions/cancel',
  renew: '/vendor/subscriptions/renew',
  trial: '/vendor/subscription/trial',
  coupon: '/vendor/subscription/coupon',
}

async function authenticateMember(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) {
    return { token: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  try {
    const response = await fetch(`${CMS_BASE}/users/me?depth=0`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    })
    if (!response.ok) {
      return { token: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    const user = (await response.json())?.user
    if (!user || user.role !== 'member') {
      return { token: null, error: NextResponse.json({ error: 'Member access required' }, { status: 403 }) }
    }
    return { token, error: null }
  } catch {
    return { token: null, error: NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 }) }
  }
}

async function readResponse(response: Response) {
  const text = await response.text()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(text || 'CMS returned an invalid response')
  }
}

function sanitizePlan(raw: Record<string, unknown>) {
  const keys = [
    'id', 'name', 'slug', 'description', 'price', 'currency', 'billing_interval',
    'trial_days', 'grace_days', 'commission_percent', 'transaction_fee', 'limits',
    'capabilities', 'status', 'display_order', 'version', 'createdAt', 'updatedAt',
  ]
  return Object.fromEntries(keys.map((key) => [key, raw[key] ?? null]))
}

export async function proxySellerMembership(
  request: NextRequest,
  action: MembershipAction,
  invoiceId?: string,
) {
  const { token, error } = await authenticateMember(request)
  if (error || !token) return error ?? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const headers = { Authorization: `JWT ${token}` }
  let url: string
  let method = 'GET'
  let body: string | undefined

  if (action === 'profiles') {
    url = `${CMS_BASE}/vendor/membership-profiles`
  } else if (action === 'plans') {
    url = `${CMS_BASE}/membership-plans?where[status][equals]=active&sort=display_order&limit=100`
  } else if (action === 'subscription') {
    const vendorId = request.nextUrl.searchParams.get('vendorId')
    if (!vendorId) return NextResponse.json({ error: 'vendorId is required' }, { status: 400 })
    url = `${CMS_BASE}/vendor/subscription?${new URLSearchParams({ vendorId })}`
  } else if (action === 'invoices') {
    const vendorId = request.nextUrl.searchParams.get('vendorId')
    if (!vendorId) return NextResponse.json({ error: 'vendorId is required' }, { status: 400 })
    const query = new URLSearchParams({ vendorId })
    for (const key of ['page', 'limit', 'status']) {
      const value = request.nextUrl.searchParams.get(key)
      if (value) query.set(key, value)
    }
    url = `${CMS_BASE}/vendor/invoices?${query}`
  } else if (action === 'invoiceDetail') {
    const vendorId = request.nextUrl.searchParams.get('vendorId')
    if (!invoiceId) return NextResponse.json({ error: 'invoiceId is required' }, { status: 400 })
    if (!vendorId) return NextResponse.json({ error: 'vendorId is required' }, { status: 400 })
    url = `${CMS_BASE}/vendor/invoices/${encodeURIComponent(invoiceId)}?${new URLSearchParams({ vendorId })}`
  } else {
    let data: Record<string, unknown>
    try {
      data = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (typeof data.vendorId !== 'string' || !data.vendorId.trim()) {
      return NextResponse.json({ error: 'vendorId is required' }, { status: 400 })
    }
    method = 'POST'
    url = `${CMS_BASE}${CMS_PATHS[action]}?${new URLSearchParams({ vendorId: data.vendorId })}`
    body = JSON.stringify(data)
  }

  try {
    const response = await fetch(url, {
      method,
      headers: method === 'POST' ? { ...headers, 'Content-Type': 'application/json' } : headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
    const data = await readResponse(response)
    if (!response.ok) return NextResponse.json(data, { status: response.status })

    if (action === 'plans') {
      const docs = Array.isArray(data.docs) ? data.docs as Record<string, unknown>[] : []
      return NextResponse.json({ ...data, docs: docs.map(sanitizePlan) })
    }
    return NextResponse.json(data, { status: response.status })
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Failed to reach CMS'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
