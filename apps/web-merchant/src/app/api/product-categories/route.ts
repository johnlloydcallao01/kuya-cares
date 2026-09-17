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

// GET /api/product-categories -> vendor-scoped read-only product categories with per-category product counts.
export async function GET(request: NextRequest) {
  const { token, user, error } = await authenticateVendorProxy(request)
  if (error) return error
  if (!token || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const qs = new URLSearchParams()
    qs.set('userId', String(user.id))
    for (const k of ['search', 'sort', 'page', 'limit', 'isActive', 'is_active', 'isFeatured', 'is_featured', 'categoryType', 'categoryLevel', 'level', 'parentCategory', 'parent']) {
      const v = searchParams.get(k)
      if (v != null && v !== '') qs.set(k, v)
    }
    const res = await fetch(`${CMS_BASE}/vendor/catalog/product-categories?${qs.toString()}`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error || 'Failed to fetch product categories' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 })
  }
}
