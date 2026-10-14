import { NextRequest } from 'next/server'
import { proxyAdminCmsRequest } from '@/lib/cmsAdminProxy'

export async function GET(request: NextRequest) {
  const query = new URL(request.url).searchParams.toString()
  return proxyAdminCmsRequest(request, `admin/members/payments${query ? `?${query}` : ''}`, 'GET')
}
