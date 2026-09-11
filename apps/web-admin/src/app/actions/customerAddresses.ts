'use server'

import { cookies } from 'next/headers'

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api').replace(/\/+$/, '')
const AUTH_COOKIE = 'tap2go-admin-token'

async function getAuthToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(AUTH_COOKIE)?.value || null
}
async function readJson(res: Response): Promise<Record<string, any>> {
  try {
    return (await res.json()) as Record<string, any>
  } catch {
    return {}
  }
}
function extractError(data: Record<string, any>, fallback: string): string {
  if (typeof data.message === 'string' && data.message) return data.message
  if (typeof data.error === 'string' && data.error) return data.error
  const errors = (data as any)?.errors as Array<{ message?: string }> | undefined
  if (Array.isArray(errors) && errors[0]?.message) return String(errors[0].message)
  if (typeof (data as any)?.details === 'string') return String((data as any).details)
  return fallback
}

// Types matching BFF sanitized address
export type AddressDoc = {
  id: number
  user: {
    id: number
    email: string
    firstName: string
    lastName: string
    middleName: string | null
    phone: string | null
    username: string | null
    role: string
    isActive: boolean | null
    profilePicture: { id: number; url: string | null; filename: string | null } | null
    createdAt: string
    updatedAt: string
  } | null
  formatted_address: string
  shortAddress: string
  google_place_id: string | null
  street_number: string | null
  route: string | null
  subpremise: string | null
  street: string | null
  floor_unit_room: string | null
  delivery_instructions: string | null
  label: string | null
  barangay: string | null
  locality: string | null
  administrative_area_level_2: string | null
  administrative_area_level_1: string | null
  country: string | null
  postal_code: string | null
  latitude: number | null
  longitude: number | null
  coordinates: unknown
  altitude: number | null
  address_quality_score: number | null
  geocoding_accuracy: string | null
  coordinate_source: string | null
  last_geocoded_at: string | null
  verification_method: string | null
  service_radius_meters: number | null
  accessibility_notes: string | null
  landmark_description: string | null
  address_type: string
  is_default: boolean
  is_verified: boolean
  notes: string | null
  // ── Admin perspective (BFF-enriched from customers.activeAddress) ──
  customer: {
    id: number
    srn: string | null
    currentLevel: string | null
    email: string | null
    activeAddressId: number | null
  } | null
  customerActiveAddressId: number | null
  customerActiveAddress: {
    id: number
    formatted_address: string
    locality: string | null
    administrative_area_level_1: string | null
    postal_code: string | null
    address_type: string | null
    is_default: boolean
    is_verified: boolean
    latitude: number | null
    longitude: number | null
  } | null
  isActiveAddress: boolean
  createdAt: string
  updatedAt: string
}

export type AddressesListParams = {
  page?: number
  limit?: number
  search?: string
  address_type?: string[]
  verification_method?: string[]
  geocoding_accuracy?: string[]
  coordinate_source?: string[]
  is_verified?: boolean | null
  is_default?: boolean | null
  is_active?: boolean | null
  locality?: string
  sort?: string
  userId?: string
  customerId?: string
}

export type AddressesListResult = {
  docs: AddressDoc[]
  pagination: { page: number; limit: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }
  stats: {
    totalAddresses: number
    totalAll: number
    filteredTotal: number
    addressTypeBreakdown: Record<string, number>
    verificationMethodBreakdown: Record<string, number>
    geocodingBreakdown: Record<string, number>
    coordinateSourceBreakdown: Record<string, number>
    localityBreakdown: Record<string, number>
    topLocalities: Array<{ name: string; count: number }>
    verifiedCount: number
    unverifiedCount: number
    defaultCount: number
    highQualityCount: number
    activeCount: number
    savedCount: number
    totalActiveCustomers: number
  }
  meta: any
}

export type AddressCreateInput = {
  user: number
  formatted_address: string
  address_type?: string
  street?: string | null
  floor_unit_room?: string | null
  delivery_instructions?: string | null
  label?: string | null
  barangay?: string | null
  locality?: string | null
  administrative_area_level_2?: string | null
  administrative_area_level_1?: string | null
  country?: string | null
  postal_code?: string | null
  latitude?: number | null
  longitude?: number | null
  verification_method?: string
  geocoding_accuracy?: string
  coordinate_source?: string
  is_default?: boolean
  is_verified?: boolean
  notes?: string | null
}

export type AddressUpdateInput = Partial<AddressCreateInput>

export async function listCustomerAddressesAction(params: AddressesListParams): Promise<AddressesListResult> {
  const token = await getAuthToken()
  if (!token) throw new Error('Not authenticated')
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.search) qs.set('search', params.search)
  if (params.address_type?.length) qs.set('address_type', params.address_type.join(','))
  if (params.verification_method?.length) qs.set('verification_method', params.verification_method.join(','))
  if (params.geocoding_accuracy?.length) qs.set('geocoding_accuracy', params.geocoding_accuracy.join(','))
  if (params.coordinate_source?.length) qs.set('coordinate_source', params.coordinate_source.join(','))
  if (params.is_verified !== null && params.is_verified !== undefined) qs.set('is_verified', String(params.is_verified))
  if (params.is_default !== null && params.is_default !== undefined) qs.set('is_default', String(params.is_default))
  if (params.is_active !== null && params.is_active !== undefined) qs.set('is_active', String(params.is_active))
  if (params.locality) qs.set('locality', params.locality)
  if (params.sort) qs.set('sort', params.sort)
  if (params.userId) qs.set('userId', params.userId)
  if (params.customerId) qs.set('customerId', params.customerId)
  const res = await fetch(`${API_BASE_URL}/admin/customers/addresses?${qs.toString()}`, {
    headers: { Authorization: `JWT ${token}` },
    cache: 'no-store',
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(extractError(data, 'Failed to load addresses'))
  return data as unknown as AddressesListResult
}

export async function getCustomerAddressAction(id: number | string): Promise<{
  doc: AddressDoc
  customer?: any
  isActiveAddress?: boolean
  customerActiveAddressId?: number | null
  customerActiveAddress?: any
  linkedMerchants?: any[]
}> {
  const token = await getAuthToken()
  if (!token) throw new Error('Not authenticated')
  const res = await fetch(`${API_BASE_URL}/admin/customers/addresses/${id}`, {
    headers: { Authorization: `JWT ${token}` },
    cache: 'no-store',
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(extractError(data, 'Failed to load address'))
  return data as { doc: AddressDoc; customer?: any; linkedMerchants?: any[] }
}

export async function createCustomerAddressAction(input: AddressCreateInput): Promise<{ success: boolean; message: string; doc?: AddressDoc }> {
  const token = await getAuthToken()
  if (!token) return { success: false, message: 'Not authenticated' }
  const res = await fetch(`${API_BASE_URL}/admin/customers/addresses`, {
    method: 'POST',
    headers: { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  })
  const data = await readJson(res)
  if (!res.ok) return { success: false, message: extractError(data, 'Failed to create address') }
  return { success: true, message: String(data.message || 'Address created'), doc: (data as any).doc }
}

export async function updateCustomerAddressAction(
  id: number | string,
  input: AddressUpdateInput
): Promise<{ success: boolean; message: string; doc?: AddressDoc }> {
  const token = await getAuthToken()
  if (!token) return { success: false, message: 'Not authenticated' }
  const res = await fetch(`${API_BASE_URL}/admin/customers/addresses/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  })
  const data = await readJson(res)
  if (!res.ok) return { success: false, message: extractError(data, 'Failed to update address') }
  return { success: true, message: String(data.message || 'Address updated'), doc: (data as any).doc }
}

export async function deleteCustomerAddressAction(id: number | string, force?: boolean): Promise<{ success: boolean; message: string }> {
  const token = await getAuthToken()
  if (!token) return { success: false, message: 'Not authenticated' }
  const qs = force ? '?force=true' : ''
  const res = await fetch(`${API_BASE_URL}/admin/customers/addresses/${id}${qs}`, {
    method: 'DELETE',
    headers: { Authorization: `JWT ${token}` },
    cache: 'no-store',
  })
  const data = await readJson(res)
  if (!res.ok) return { success: false, message: extractError(data, 'Failed to delete address') }
  return { success: true, message: String((data as any).message || 'Address deleted') }
}
