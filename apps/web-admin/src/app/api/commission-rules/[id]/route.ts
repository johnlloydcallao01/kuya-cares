import { NextRequest } from 'next/server'
import { proxyAdminCmsRequest, readJsonBody } from '@/lib/cmsAdminProxy'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await readJsonBody(request)
  if (body instanceof Response) return body
  return proxyAdminCmsRequest(request, `commission-rules/${encodeURIComponent(id)}`, 'PATCH', body)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxyAdminCmsRequest(request, `commission-rules/${encodeURIComponent(id)}`, 'DELETE')
}
