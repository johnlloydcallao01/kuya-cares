import { NextRequest, NextResponse } from 'next/server'

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '')
const AUTH_COOKIE = 'kuyacares-admin-token'

async function proxy(request: NextRequest, id: string, method: 'GET' | 'PUT') {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: string | undefined
  if (method === 'PUT') {
    try {
      body = JSON.stringify(await request.json())
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
  }

  try {
    const response = await fetch(`${CMS_BASE}/admin/merchants/${encodeURIComponent(id)}/shipping-settings`, {
      method,
      headers: {
        Authorization: `JWT ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body } : {}),
      cache: 'no-store',
    })
    const data = await response.text()
    return new NextResponse(data, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 })
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxy(request, id, 'GET')
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxy(request, id, 'PUT')
}
