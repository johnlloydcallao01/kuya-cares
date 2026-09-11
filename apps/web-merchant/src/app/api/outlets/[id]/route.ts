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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, user, error } = await authenticateVendorProxy(request)
  if (error) return error
  if (!token || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await fetch(`${CMS_BASE}/vendor/outlets/${id}`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error || 'Failed to fetch outlet' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, user, error } = await authenticateVendorProxy(request)
  if (error) return error
  if (!token || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json()
    const res = await fetch(`${CMS_BASE}/vendor/outlets/${id}`, {
      method: 'PATCH',
      headers: {
        Authorization: `JWT ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    // Mirror web-admin vendors proxy: preserve exact CMS status/body (enterprise raw passthrough)
    // so verification errors (500 Outlet update verification failed) are not masked as generic 400.
    const text = await res.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      data = { error: text || 'Failed to update outlet' }
    }
    if (!res.ok) {
      const errObj = data as Record<string, unknown>
      return NextResponse.json(
        { error: (errObj.error as string) || (errObj.message as string) || 'Failed to update outlet', details: (errObj.details as unknown) ?? errObj, raw: errObj },
        { status: res.status },
      )
    }
    // Use raw text round-trip to avoid double-parse drift, exactly like web-admin vendors route
    return new NextResponse(text, { status: res.status, headers: { 'Content-Type': 'application/json' } })
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { token, user, error } = await authenticateVendorProxy(request)
  if (error) return error
  if (!token || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await fetch(`${CMS_BASE}/vendor/outlets/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data.error || 'Failed to delete outlet' }, { status: res.status })
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 })
  }
}
