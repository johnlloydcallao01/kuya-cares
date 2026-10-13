import { NextRequest } from 'next/server'
import { proxyAdminCmsRequest } from '@/lib/cmsAdminProxy'

export async function GET(request: NextRequest) {
  const query = new URL(request.url).searchParams
  query.set('limit', '100')
  query.set('depth', '1')
  query.set('sort', '-effective_at')
  return proxyAdminCmsRequest(request, `vendor-commission-entries?${query.toString()}`, 'GET')
}
