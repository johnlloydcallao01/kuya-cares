import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api').replace(/\/+$/, '')
const AUTH_COOKIE = 'tap2go-merchant-token'

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

// GET /api/addresses?outletId=16 | ?merchantId=16 | ?vendorId=5
// -> vendor-owned addresses for the Active Address picker.
// Proxies CMS GET /api/vendor/addresses with the same outlet/vendor context so the
// backend can mirror Merchants.activeAddress.filterOptions:
//   merchant.vendor -> vendors.user -> addresses where user == vendorUserId.
export async function GET(request: NextRequest) {
  const { token, user, error } = await authenticateVendorProxy(request)
  if (error) return error
  if (!token || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const outletId = searchParams.get('outletId') || searchParams.get('merchantId')
    const vendorId = searchParams.get('vendorId')
    const limit = searchParams.get('limit')
    const qs = new URLSearchParams()
    if (outletId) qs.set('merchantId', outletId)
    if (vendorId) qs.set('vendorId', vendorId)
    if (limit) qs.set('limit', limit)
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    const res = await fetch(`${CMS_BASE}/vendor/addresses${suffix}`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error || 'Failed to fetch addresses' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 })
  }
}
