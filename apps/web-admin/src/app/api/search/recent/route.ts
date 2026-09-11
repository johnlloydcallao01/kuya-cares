import { NextRequest, NextResponse } from 'next/server'

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api').replace(/\/+$/, '')
const AUTH_COOKIE = 'tap2go-admin-token'

async function forward(request: NextRequest, method: 'GET' | 'POST' | 'DELETE') {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const url = new URL(request.url)
  const init: RequestInit = {
    method,
    headers: { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  }
  if (method === 'POST') init.body = await request.text()
  const response = await fetch(`${CMS_BASE}/admin/search/recent${url.search}`, init)
  const data = await response.text()
  return new NextResponse(data, { status: response.status, headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' } })
}

export async function GET(request: NextRequest) { return forward(request, 'GET') }
export async function POST(request: NextRequest) { return forward(request, 'POST') }
export async function DELETE(request: NextRequest) { return forward(request, 'DELETE') }