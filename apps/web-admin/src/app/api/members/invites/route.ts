import { NextRequest } from 'next/server'
import { proxyAdminCmsRequest, readJsonBody } from '@/lib/cmsAdminProxy'

export async function GET(request: NextRequest) {
  const query = new URL(request.url).searchParams.toString()
  return proxyAdminCmsRequest(request, `admin/members/invites${query ? `?${query}` : ''}`, 'GET')
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request)
  if (body instanceof Response) return body
  return proxyAdminCmsRequest(request, 'admin/members/invites', 'POST', body)
}
