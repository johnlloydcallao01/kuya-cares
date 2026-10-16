import { NextRequest } from 'next/server'
import { proxyAdminCmsRequest } from '@/lib/cmsAdminProxy'

export async function GET(request: NextRequest) {
  const query = new URL(request.url).searchParams
  query.set('limit', '100')
  query.set('offset', query.get('offset') || '0')
  return proxyAdminCmsRequest(request, `admin/vendors/withdrawal-requests?${query.toString()}`, 'GET')
}