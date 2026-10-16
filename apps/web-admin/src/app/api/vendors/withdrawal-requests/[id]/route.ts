import { NextRequest } from 'next/server'
import { proxyAdminCmsRequest, readJsonBody } from '@/lib/cmsAdminProxy'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  if (!/^[1-9]\d*$/.test(id)) {
    return Response.json({ error: 'Invalid withdrawal request id' }, { status: 400 })
  }
  const body = await readJsonBody(request)
  if (body instanceof Response) return body
  return proxyAdminCmsRequest(request, `admin/vendors/withdrawal-requests/${id}`, 'PATCH', body)
}