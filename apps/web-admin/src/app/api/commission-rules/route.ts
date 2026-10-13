import { NextRequest } from 'next/server'
import { proxyAdminCmsRequest, readJsonBody } from '@/lib/cmsAdminProxy'

export async function GET(request: NextRequest) {
  const query = new URL(request.url).searchParams
  query.set('limit', '1000')
  query.set('depth', '1')
  query.set('sort', '-priority')
  return proxyAdminCmsRequest(request, `commission-rules?${query.toString()}`, 'GET')
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request)
  if (body instanceof Response) return body
  return proxyAdminCmsRequest(request, 'commission-rules', 'POST', body)
}
