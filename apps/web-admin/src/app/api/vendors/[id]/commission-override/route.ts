import { NextRequest, NextResponse } from 'next/server'
import { proxyAdminCmsRequest, readJsonBody } from '@/lib/cmsAdminProxy'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxyAdminCmsRequest(request, `admin/vendors/${encodeURIComponent(id)}`)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await readJsonBody(request)
  if (body instanceof Response) return body
  return proxyAdminCmsRequest(request, `admin/vendors/${encodeURIComponent(id)}/commission-override`, 'PUT', body)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  return proxyAdminCmsRequest(request, `admin/vendors/${encodeURIComponent(id)}/commission-override`, 'DELETE')
}
