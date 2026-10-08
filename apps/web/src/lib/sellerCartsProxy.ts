import { NextRequest, NextResponse } from 'next/server'

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '')

export async function proxySellerCarts(request: NextRequest): Promise<NextResponse> {
  const token = request.cookies.get('kuyacares-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const userResponse = await fetch(`${CMS_BASE}/users/me?depth=0`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    })
    if (!userResponse.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = (await userResponse.json())?.user
    if (!user || !['member', 'vendor'].includes(user.role) || user.id == null) {
      return NextResponse.json({ error: 'Seller access required' }, { status: 403 })
    }

    const query = new URLSearchParams()
    for (const key of ['vendorId', 'search', 'sort', 'page', 'limit', 'outletId']) {
      const value = request.nextUrl.searchParams.get(key)
      if (value) query.set(key, value)
    }

    const response = await fetch(`${CMS_BASE}/vendor/activity/carts?${query.toString()}`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
    const text = await response.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: text || 'CMS returned an invalid carts response' }, { status: 502 })
    }
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 })
  }
}
