import { NextRequest, NextResponse } from 'next/server'

const CMS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '')
const QUERY_KEYS = ['search', 'sort', 'page', 'limit', 'outletId']

type CustomerDataType = 'customers' | 'addresses' | 'emergency-contacts'

async function proxySellerCustomerData(request: NextRequest, dataType: CustomerDataType): Promise<NextResponse> {
  const token = request.cookies.get('kuyacares-token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const userResponse = await fetch(`${CMS_BASE}/users/me?depth=0`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(25000),
    })
    if (!userResponse.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const user = (await userResponse.json())?.user
    if (!user || !['member', 'vendor'].includes(user.role) || user.id == null) {
      return NextResponse.json({ error: 'Seller access required' }, { status: 403 })
    }

    const query = new URLSearchParams()
    const vendorId = request.nextUrl.searchParams.get('vendorId')
    if (vendorId) query.set('vendorId', vendorId)
    const queryKeys = dataType === 'addresses'
      ? [...QUERY_KEYS, 'address_type', 'is_default']
      : dataType === 'emergency-contacts'
        ? [...QUERY_KEYS, 'relationship', 'isPrimary', 'is_primary']
        : QUERY_KEYS
    for (const key of queryKeys) {
      const value = request.nextUrl.searchParams.get(key)
      if (value != null && value !== '') query.set(key, value)
    }

    const endpoint = dataType === 'addresses'
      ? '/vendor/customers/addresses'
      : dataType === 'emergency-contacts'
        ? '/vendor/customers/emergency-contacts'
        : '/vendor/customers'
    const response = await fetch(`${CMS_BASE}${endpoint}?${query.toString()}`, {
      headers: { Authorization: `JWT ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000),
    })
    const text = await response.text()
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: text || 'CMS returned an invalid customer response' }, { status: 502 })
    }
    return NextResponse.json(data, { status: response.status })
  } catch {
    return NextResponse.json({ error: 'Failed to reach CMS' }, { status: 502 })
  }
}

export function proxySellerCustomers(request: NextRequest): Promise<NextResponse> {
  return proxySellerCustomerData(request, 'customers')
}

export function proxySellerCustomerAddresses(request: NextRequest): Promise<NextResponse> {
  return proxySellerCustomerData(request, 'addresses')
}

export function proxySellerEmergencyContacts(request: NextRequest): Promise<NextResponse> {
  return proxySellerCustomerData(request, 'emergency-contacts')
}
