import { NextRequest, NextResponse } from 'next/server'

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '')
const AUTH_COOKIE = 'kuyacares-admin-token'

export async function proxyAdminCmsRequest(
  request: NextRequest,
  cmsPath: string,
  method = request.method,
  body?: string,
): Promise<NextResponse> {
  const token = request.cookies.get(AUTH_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const response = await fetch(`${CMS_BASE}/${cmsPath.replace(/^\/+/, '')}`, {
      method,
      headers: {
        Authorization: `JWT ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body } : {}),
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
    const data = await response.text()
    return new NextResponse(data, {
      status: response.status,
      headers: { 'Content-Type': response.headers.get('content-type') || 'application/json' },
    })
  } catch (error) {
    console.error(`[web-admin CMS proxy] ${method} ${cmsPath} failed:`, error)
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 })
  }
}

export async function readJsonBody(request: NextRequest): Promise<string | NextResponse> {
  try {
    return JSON.stringify(await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
}
