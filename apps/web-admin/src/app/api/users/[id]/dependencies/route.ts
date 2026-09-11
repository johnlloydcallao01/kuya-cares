import { NextRequest, NextResponse } from 'next/server'

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api').replace(/\/+$/, '')
const AUTH_COOKIE = 'tap2go-admin-token'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const res = await fetch(`${CMS_BASE}/admin/users/${id}/dependencies`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
    })
    const data = await res.text()
    const headers = new Headers({ 'Content-Type': res.headers.get('content-type') || 'application/json' })
    const cacheStatus = res.headers.get('X-UserDependencies-Cache')
    if (cacheStatus) headers.set('X-UserDependencies-Cache', cacheStatus)
    return new NextResponse(data, { status: res.status, headers })
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 })
  }
}
