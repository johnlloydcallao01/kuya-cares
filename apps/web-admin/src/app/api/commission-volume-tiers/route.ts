import { NextRequest } from 'next/server'
import { proxyAdminCmsRequest, readJsonBody } from '@/lib/cmsAdminProxy'

export async function GET(request: NextRequest) {
  return proxyAdminCmsRequest(request, 'globals/system-settings', 'GET')
}

export async function PATCH(request: NextRequest) {
  const body = await readJsonBody(request)
  if (body instanceof Response) return body
  return proxyAdminCmsRequest(request, 'globals/system-settings', 'PATCH', body)
}
