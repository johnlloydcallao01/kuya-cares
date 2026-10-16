import { NextRequest, NextResponse } from 'next/server'

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '')
const AUTH_COOKIE = 'kuyacares-admin-token'

async function forward(request: NextRequest, cmsPath: string, init?: { method?: string; body?: unknown }) {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    let body: string | undefined
    if (init?.body !== undefined) {
      try {
        body = JSON.stringify(init.body)
      } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
      }
    }
    const res = await fetch(`${CMS_BASE}${cmsPath}`, {
      method: init?.method ?? 'GET',
      headers: {
        Authorization: `JWT ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(45000),
    })
    const data = await res.text()
    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 })
  }
}

export async function GET(request: NextRequest) {
  const qs = new URL(request.url).searchParams.toString()
  return forward(request, `/admin/finance/payments${qs ? `?${qs}` : ''}`)
}
