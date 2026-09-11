'use server'

import { cookies } from 'next/headers'

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api').replace(/\/+$/, '')
const AUTH_COOKIE = 'tap2go-admin-token'

async function getAuthToken(): Promise<string | null> {
  const store = await cookies()
  return store.get(AUTH_COOKIE)?.value || null
}
async function readJson(res: Response): Promise<Record<string, any>> {
  try { return (await res.json()) as Record<string, any> } catch { return {} }
}
function extractError(data: Record<string, any>, fallback: string): string {
  if (typeof data.message === 'string' && data.message) return data.message
  if (typeof data.error === 'string' && data.error) return data.error
  const errors = (data as any)?.errors as Array<{ message?: string }> | undefined
  if (Array.isArray(errors) && errors[0]?.message) return String(errors[0].message)
  if (typeof (data as any)?.details === 'string') return String((data as any).details)
  return fallback
}

// Types for BFF
export type VendorDoc = {
  id: number
  businessName: string
  legalName: string
  businessRegistrationNumber: string
  taxIdentificationNumber: string | null
  primaryContactEmail: string
  primaryContactPhone: string
  websiteUrl: string | null
  businessType: string
  cuisineTypes: unknown
  isActive: boolean
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'suspended' | string
  onboardingDate: string | null
  averageRating: number
  totalReviews: number
  totalOrders: number
  totalMerchants: number
  storedTotalMerchants: number
  description: string | null
  operatingHours: unknown
  socialMediaLinks: any
  logo: { id: number; url: string | null; filename: string | null } | null
  businessLicense: { id: number; url: string | null; filename: string | null } | null
  taxCertificate: { id: number; url: string | null; filename: string | null } | null
  owner: { id: number; email: string; firstName: string; lastName: string; role: string; isActive: boolean | null; phone: string | null } | null
  createdAt: string
  updatedAt: string
  merchantsPreview?: Array<{ id: number; outletName: string; outletCode: string; isActive: boolean; isAcceptingOrders: boolean; operationalStatus: string }>
}
export type VendorsListParams = {
  page?: number
  limit?: number
  search?: string
  verificationStatus?: string[]
  businessType?: string[]
  isActive?: boolean | null
  sort?: string
}
export type VendorsListResult = {
  docs: VendorDoc[]
  pagination: { page: number; limit: number; totalDocs: number; totalPages: number; hasNextPage: boolean; hasPrevPage: boolean }
  stats: { totalVendors: number; totalAll: number; filteredTotal: number; verificationBreakdown: Record<string, number>; businessTypeBreakdown: Record<string, number>; activeCount: number; inactiveCount: number }
  meta: any
}
export type VendorCreateInput = {
  businessName: string
  legalName: string
  businessRegistrationNumber: string
  taxIdentificationNumber?: string | null
  primaryContactEmail: string
  primaryContactPhone: string
  websiteUrl?: string | null
  businessType: string
  cuisineTypes?: unknown
  isActive?: boolean
  verificationStatus?: string
  description?: string | null
  operatingHours?: unknown
  socialMediaLinks?: any
  // owner creation
  ownerFirstName?: string
  ownerLastName?: string
  ownerEmail?: string
  ownerPassword?: string
  userId?: number
}
export type VendorUpdateInput = Partial<VendorCreateInput> & { verificationStatus?: string; isActive?: boolean }

/**
 * BFF thin consumer: list vendors via single aggregation endpoint
 */
export async function listVendorsAction(params: VendorsListParams): Promise<VendorsListResult> {
  const token = await getAuthToken()
  if (!token) throw new Error('Not authenticated')
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.search) qs.set('search', params.search)
  if (params.verificationStatus?.length) qs.set('verificationStatus', params.verificationStatus.join(','))
  if (params.businessType?.length) qs.set('businessType', params.businessType.join(','))
  if (params.isActive !== null && params.isActive !== undefined) qs.set('isActive', String(params.isActive))
  if (params.sort) qs.set('sort', params.sort)
  const res = await fetch(`${API_BASE_URL}/admin/vendors?${qs.toString()}`, {
    headers: { Authorization: `JWT ${token}` },
    cache: 'no-store',
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(extractError(data, 'Failed to load vendors'))
  return data as unknown as VendorsListResult
}

export async function getVendorAction(id: number | string): Promise<{ doc: VendorDoc }> {
  const token = await getAuthToken()
  if (!token) throw new Error('Not authenticated')
  const res = await fetch(`${API_BASE_URL}/admin/vendors/${id}`, {
    headers: { Authorization: `JWT ${token}` },
    cache: 'no-store',
  })
  const data = await readJson(res)
  if (!res.ok) throw new Error(extractError(data, 'Failed to load vendor'))
  return data as { doc: VendorDoc }
}

export async function createVendorAction(input: VendorCreateInput): Promise<{ success: boolean; message: string; doc?: VendorDoc }> {
  const token = await getAuthToken()
  if (!token) return { success: false, message: 'Not authenticated' }
  const res = await fetch(`${API_BASE_URL}/admin/vendors`, {
    method: 'POST',
    headers: { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  })
  const data = await readJson(res)
  if (!res.ok) return { success: false, message: extractError(data, 'Failed to create vendor') }
  return { success: true, message: String(data.message || 'Vendor created'), doc: (data as any).doc }
}

export async function updateVendorAction(id: number | string, input: VendorUpdateInput): Promise<{ success: boolean; message: string; doc?: VendorDoc }> {
  const token = await getAuthToken()
  if (!token) return { success: false, message: 'Not authenticated' }
  const res = await fetch(`${API_BASE_URL}/admin/vendors/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  })
  const data = await readJson(res)
  if (!res.ok) return { success: false, message: extractError(data, 'Failed to update vendor') }
  return { success: true, message: String(data.message || 'Vendor updated'), doc: (data as any).doc }
}

export async function deleteVendorAction(id: number | string, force?: boolean): Promise<{ success: boolean; message: string }> {
  const token = await getAuthToken()
  if (!token) return { success: false, message: 'Not authenticated' }
  const qs = force ? '?force=true' : ''
  const res = await fetch(`${API_BASE_URL}/admin/vendors/${id}${qs}`, {
    method: 'DELETE',
    headers: { Authorization: `JWT ${token}` },
    cache: 'no-store',
  })
  const data = await readJson(res)
  if (!res.ok) return { success: false, message: extractError(data, 'Failed to delete vendor') }
  return { success: true, message: String((data as any).message || 'Vendor deleted') }
}
