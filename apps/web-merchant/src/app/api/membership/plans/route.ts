import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '')
const AUTH_COOKIE = 'kuyacares-merchant-token'
// Service key (same pattern as /api/search): authenticates as `service` role so the
// public plan catalog also works for anonymous signup visitors (no vendor JWT yet).
const SERVICE_API_KEY = process.env.PAYLOAD_API_KEY || process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || ''

// Vendor-safe plan shape (mirrors CMS sanitizePlan — strips internal provider refs).
function sanitizePlanDoc(raw: Record<string, unknown>): Record<string, unknown> {
  const pick = (v: unknown) => v ?? null
  const relId = (v: unknown) =>
    v != null && typeof v === 'object' && 'id' in (v as Record<string, unknown>)
      ? String((v as Record<string, unknown>).id)
      : (v ?? null)
  return {
    id: pick(raw.id),
    name: pick(raw.name),
    slug: pick(raw.slug),
    description: pick(raw.description),
    price: pick(raw.price),
    currency: pick(raw.currency),
    billing_interval: pick(raw.billing_interval),
    trial_days: pick(raw.trial_days),
    grace_days: pick(raw.grace_days),
    commission_percent: pick(raw.commission_percent),
    transaction_fee: pick(raw.transaction_fee),
    limits: pick(raw.limits),
    capabilities: pick(raw.capabilities),
    status: pick(raw.status),
    display_order: pick(raw.display_order),
    version: pick(raw.version),
    createdAt: pick(raw.createdAt),
    updatedAt: pick(raw.updatedAt),
  }
}

// Plans are public price data: vendor JWT when signed in, service key when
// configured, otherwise anonymous (CMS allows public read of active plans).
async function resolveAuthHeader(request: NextRequest): Promise<{ headers: Record<string, string> }> {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (token) {
    try {
      const meRes = await fetch(`${CMS_BASE}/users/me?depth=2`, {
        headers: { Authorization: `JWT ${token}` },
        cache: 'no-store',
      })
      if (meRes.ok) {
        const me = await meRes.json()
        const user = (me as { user?: { role?: string } })?.user
        if (user && user.role === 'vendor') return { headers: { Authorization: `JWT ${token}` } }
      }
    } catch {
      // Fall through below.
    }
  }
  if (SERVICE_API_KEY) return { headers: { Authorization: `users API-Key ${SERVICE_API_KEY}` } }
  return { headers: {} }
}

export async function GET(request: NextRequest) {
  const auth = await resolveAuthHeader(request)

  try {
    const res = await fetch(
      `${CMS_BASE}/membership-plans?where[status][equals]=active&sort=display_order&limit=100`,
      {
        headers: auth.headers,
        cache: 'no-store',
      },
    )
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const message =
        (data as { error?: string; message?: string }).error ||
        (data as { message?: string }).message ||
        'Failed to fetch membership plans'
      return NextResponse.json({ error: message }, { status: res.status })
    }
    const docs = Array.isArray((data as { docs?: unknown[] }).docs)
      ? (data as { docs: Record<string, unknown>[] }).docs.map(sanitizePlanDoc)
      : []
    return NextResponse.json({ ...(data as Record<string, unknown>), docs })
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 })
  }
}
