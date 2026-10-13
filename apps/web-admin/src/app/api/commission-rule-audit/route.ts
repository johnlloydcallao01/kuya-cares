import { NextRequest } from 'next/server'
import { proxyAdminCmsRequest } from '@/lib/cmsAdminProxy'

export async function GET(request: NextRequest) {
  return proxyAdminCmsRequest(request, 'admin/commission-rules/audit', 'GET')
}
