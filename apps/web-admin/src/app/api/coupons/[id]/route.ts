import { NextRequest, NextResponse } from 'next/server'

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api').replace(/\/+$/, '')
const AUTH_COOKIE = 'tap2go-admin-token'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const res = await fetch(`${CMS_BASE}/admin/coupons/${id}`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
    })
    const data = await res.text()
    return new NextResponse(data, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } })
  } catch { return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 }) }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  try {
    const res = await fetch(`${CMS_BASE}/admin/coupons/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    })
    const data = await res.text()
    return new NextResponse(data, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } })
  } catch { return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 }) }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const qs = searchParams.toString() ? `?${searchParams.toString()}` : ''
  try {
    const res = await fetch(`${CMS_BASE}/admin/coupons/${id}${qs}`, {
      method: 'DELETE',
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
    })
    const data = await res.text()
    return new NextResponse(data, { status: res.status, headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' } })
  } catch { return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 }) }
}
