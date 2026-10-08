'use server'

import type { User } from '@/types/auth'
import { getServerToken } from './auth'

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '')

async function readJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return await response.json() as Record<string, unknown>
  } catch {
    return {}
  }
}

function errorMessage(data: Record<string, unknown>, fallback: string): string {
  if (typeof data.error === 'string' && data.error) return data.error
  if (typeof data.message === 'string' && data.message) return data.message
  return fallback
}

async function requireToken(): Promise<string> {
  const token = await getServerToken()
  if (!token) throw new Error('Not authenticated. Please sign in again.')
  return token
}

export type RawUser = User & {
  loginAttempts?: number | null
  lockUntil?: string | null
  sessions?: Array<{ id: string; createdAt?: string | null; expiresAt: string }> | null
}

export type VendorRecord = {
  id: number
  businessName: string
  legalName: string
  businessRegistrationNumber?: string | null
  taxIdentificationNumber?: string | null
  primaryContactEmail: string
  primaryContactPhone: string
  websiteUrl?: string | null
  businessType?: string | null
  cuisineTypes?: unknown
  isActive?: boolean | null
  verificationStatus: string
  onboardingDate?: string | null
  averageRating: number
  totalReviews: number
  totalOrders: number
  totalMerchants: number
  description?: string | null
  operatingHours?: unknown
  socialMediaLinks?: unknown
  businessLicense?: { id: number; url: string | null; filename: string } | null
  taxCertificate?: { id: number; url: string | null; filename: string } | null
  logo?: { id: number; url: string | null; filename: string } | null
  createdAt: string
  updatedAt: string
}

export type MerchantSummary = {
  id: number
  outletName: string
  outletSlug?: string | null
  operationalStatus: string
  isActive?: boolean | null
  isAcceptingOrders?: boolean | null
  averageRating: number
  totalReviews: number
  createdAt: string
  updatedAt: string
}

export type UserEventItem = {
  id: number
  eventType: string
  eventData: unknown
  timestamp?: string | null
  createdAt: string
  ipAddress?: string | null
  userAgent?: string | null
}

export type ProfileUpdateInput = {
  firstName: string
  lastName: string
  middleName?: string | null
  nameExtension?: string | null
  username?: string | null
  phone?: string | null
  gender?: string | null
  civilStatus?: string | null
  nationality?: string | null
  birthDate?: string | null
  placeOfBirth?: string | null
  completeAddress?: string | null
  email?: string | null
}

export async function getProfileData(): Promise<{
  user: User
  raw: RawUser | null
  vendor: VendorRecord | null
  merchants: MerchantSummary[]
  merchantsCount: number
  activities: UserEventItem[]
}> {
  const token = await requireToken()
  const response = await fetch(`${API_BASE_URL}/vendor/profile`, {
    headers: { Authorization: `JWT ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const data = await readJson(response)
  if (!response.ok) throw new Error(errorMessage(data, 'Failed to fetch profile'))
  const user = data.user as User | undefined
  if (!user || typeof user.id !== 'number') throw new Error('Invalid profile response')

  return {
    user,
    raw: (data.raw as RawUser) || null,
    vendor: (data.vendor as VendorRecord) || null,
    merchants: Array.isArray(data.merchants) ? data.merchants as MerchantSummary[] : [],
    merchantsCount: typeof data.merchantsCount === 'number' ? data.merchantsCount : 0,
    activities: Array.isArray(data.activities) ? data.activities as UserEventItem[] : [],
  }
}

export async function updateProfileAction(input: ProfileUpdateInput): Promise<{ success: boolean; user?: User; message: string }> {
  const token = await requireToken()
  const response = await fetch(`${API_BASE_URL}/vendor/profile`, {
    method: 'PATCH',
    headers: { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const data = await readJson(response)
  if (!response.ok) return { success: false, message: errorMessage(data, 'Failed to update profile') }
  return {
    success: true,
    user: data.user as User | undefined,
    message: typeof data.message === 'string' ? data.message : 'Profile updated successfully.',
  }
}

export async function changePasswordAction(input: { currentPassword: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
  const token = await requireToken()
  const response = await fetch(`${API_BASE_URL}/vendor/profile/password`, {
    method: 'POST',
    headers: { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const data = await readJson(response)
  if (!response.ok) return { success: false, message: errorMessage(data, 'Failed to change password') }
  return { success: true, message: typeof data.message === 'string' ? data.message : 'Password changed successfully.' }
}

export async function uploadAvatarAction(formData: FormData): Promise<{ success: boolean; message: string; user?: User }> {
  const token = await requireToken()
  const response = await fetch(`${API_BASE_URL}/vendor/profile/avatar`, {
    method: 'POST',
    headers: { Authorization: `JWT ${token}` },
    body: formData,
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  })
  const data = await readJson(response)
  if (!response.ok) return { success: false, message: errorMessage(data, 'Failed to upload image') }
  return {
    success: true,
    message: typeof data.message === 'string' ? data.message : 'Profile picture updated',
    user: data.user as User | undefined,
  }
}

export async function removeAvatarAction(): Promise<{ success: boolean; message: string; user?: User }> {
  const token = await requireToken()
  const response = await fetch(`${API_BASE_URL}/vendor/profile/avatar`, {
    method: 'DELETE',
    headers: { Authorization: `JWT ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  })
  const data = await readJson(response)
  if (!response.ok) return { success: false, message: errorMessage(data, 'Failed to remove picture') }
  return {
    success: true,
    message: typeof data.message === 'string' ? data.message : 'Profile picture removed',
    user: data.user as User | undefined,
  }
}
