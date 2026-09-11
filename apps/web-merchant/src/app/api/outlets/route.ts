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

export async function GET(request: NextRequest) {
  const { token, user, error } = await authenticateVendorProxy(request)
  if (error) return error
  if (!token || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await fetch(`${CMS_BASE}/vendor/outlets?userId=${user.id}`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error || 'Failed to fetch outlets' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  const { token, user, error } = await authenticateVendorProxy(request)
  if (error) return error
  if (!token || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    body.userId = user.id

    const res = await fetch(`${CMS_BASE}/vendor/outlets`, {
      method: 'POST',
      headers: {
        Authorization: `JWT ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error || 'Failed to create outlet', details: data.details }, { status: res.status })
    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 })
  }
}
