'use server';

import { cookies } from 'next/headers';
import type { User } from '@/types/auth';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.tap2goph.com/api').replace(/\/+$/, '');
const AUTH_COOKIE = 'tap2go-merchant-token';

async function getAuthToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(AUTH_COOKIE)?.value || null;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function extractError(data: Record<string, unknown>, fallback: string): string {
  if (typeof data.message === 'string' && data.message) return data.message;
  if (typeof data.error === 'string' && data.error) return data.error;
  const errors = (data as { errors?: Array<{ message?: string }> }).errors;
  if (Array.isArray(errors) && errors[0]?.message) return String(errors[0].message);
  return fallback;
}

export type RawUser = User & {
  loginAttempts?: number | null;
  lockUntil?: string | null;
  apiKey?: string | null;
  enableAPIKey?: boolean | null;
  sessions?: Array<{ id: string; createdAt?: string | null; expiresAt: string }> | null;
};

export type VendorRecord = {
  id: number;
  businessName: string;
  legalName: string;
  businessRegistrationNumber?: string | null;
  taxIdentificationNumber?: string | null;
  primaryContactEmail: string;
  primaryContactPhone: string;
  websiteUrl?: string | null;
  businessType?: string | null;
  cuisineTypes?: unknown;
  isActive?: boolean | null;
  verificationStatus: string;
  onboardingDate?: string | null;
  averageRating: number;
  totalReviews: number;
  totalOrders: number;
  totalMerchants: number;
  description?: string | null;
  operatingHours?: unknown;
  socialMediaLinks?: unknown;
  businessLicense?: { id: number; url: string | null; filename: string } | null;
  taxCertificate?: { id: number; url: string | null; filename: string } | null;
  logo?: { id: number; url: string | null; filename: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type MerchantSummary = {
  id: number;
  outletName: string;
  outletSlug?: string | null;
  operationalStatus: string;
  isActive?: boolean | null;
  isAcceptingOrders?: boolean | null;
  averageRating: number;
  totalReviews: number;
  createdAt: string;
  updatedAt: string;
};

export type UserEventItem = {
  id: number;
  eventType: string;
  eventData: unknown;
  timestamp?: string | null;
  createdAt: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type ProfileUpdateInput = {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  nameExtension?: string | null;
  username?: string | null;
  phone?: string | null;
  gender?: string | null;
  civilStatus?: string | null;
  nationality?: string | null;
  birthDate?: string | null;
  placeOfBirth?: string | null;
  completeAddress?: string | null;
  email?: string | null;
};

/**
 * BFF thin consumer: single aggregation endpoint for vendor.
 * Backend (apps/cms/src/app/api/vendor/profile) owns auth, joins, sanitization with overrideAccess.
 */
export async function getProfileData(): Promise<{
  user: User;
  raw: RawUser | null;
  vendor: VendorRecord | null;
  merchants: MerchantSummary[];
  merchantsCount: number;
  activities: UserEventItem[];
}> {
  const token = await getAuthToken();
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(`${API_BASE_URL}/vendor/profile`, {
    method: 'GET',
    headers: { Authorization: `JWT ${token}` },
    cache: 'no-store',
  });
  const data = await readJson(res);
  if (!res.ok) throw new Error(extractError(data, 'Failed to fetch profile'));

  const user = data.user as unknown as User;
  const raw = data.raw as unknown as RawUser;
  const vendor = (data.vendor as unknown as VendorRecord) || null;
  const merchants = (data.merchants as unknown as MerchantSummary[]) || [];
  const merchantsCount = typeof data.merchantsCount === 'number' ? data.merchantsCount : merchants.length;
  const activities = (data.activities as unknown as UserEventItem[]) || [];

  if (!user || typeof user.id !== 'number') throw new Error('Invalid profile response');

  return { user, raw: raw || (user as RawUser), vendor, merchants, merchantsCount, activities };
}

export async function updateProfileAction(payloadInput: ProfileUpdateInput): Promise<{
  success: boolean;
  user?: User;
  message: string;
}> {
  const token = await getAuthToken();
  if (!token) return { success: false, message: 'Not authenticated. Please sign in again.' };

  const firstName = payloadInput.firstName?.trim();
  const lastName = payloadInput.lastName?.trim();
  if (!firstName || firstName.length < 2) return { success: false, message: 'First name must be at least 2 characters.' };
  if (!lastName || lastName.length < 2) return { success: false, message: 'Last name must be at least 2 characters.' };

  const res = await fetch(`${API_BASE_URL}/vendor/profile`, {
    method: 'PATCH',
    headers: { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadInput),
    cache: 'no-store',
  });
  const data = await readJson(res);
  if (!res.ok) {
    return { success: false, message: extractError(data, 'Failed to update profile') };
  }

  const user = (data.user as unknown as User) || undefined;
  return { success: true, user, message: String((data as any).message || 'Profile updated successfully.') };
}

export async function changePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  const token = await getAuthToken();
  if (!token) return { success: false, message: 'Not authenticated' };
  const { currentPassword, newPassword } = input;
  if (!currentPassword || !newPassword) return { success: false, message: 'Both passwords are required.' };

  const res = await fetch(`${API_BASE_URL}/vendor/profile/password`, {
    method: 'POST',
    headers: { Authorization: `JWT ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword }),
    cache: 'no-store',
  });
  const data = await readJson(res);
  if (!res.ok) return { success: false, message: extractError(data, 'Failed to change password') };
  return { success: true, message: String((data as any).message || 'Password changed successfully.') };
}

export async function uploadAvatarAction(formData: FormData): Promise<{
  success: boolean;
  message: string;
  user?: User;
}> {
  const token = await getAuthToken();
  if (!token) return { success: false, message: 'Not authenticated' };

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) return { success: false, message: 'No file provided' };

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
  if (!allowed.includes(file.type)) return { success: false, message: 'Only JPG, PNG, WebP, GIF or AVIF allowed' };
  if (file.size > 5 * 1024 * 1024) return { success: false, message: 'File too large. Max 5 MB.' };

  const forward = new FormData();
  forward.append('file', file, file.name);

  const res = await fetch(`${API_BASE_URL}/vendor/profile/avatar`, {
    method: 'POST',
    headers: { Authorization: `JWT ${token}` },
    body: forward,
  });
  const data = await readJson(res);
  if (!res.ok) return { success: false, message: extractError(data, 'Failed to upload image') };

  const user = (data.user as unknown as User) || undefined;
  return { success: true, message: String((data as any).message || 'Profile picture updated'), user };
}

export async function removeAvatarAction(): Promise<{
  success: boolean;
  message: string;
  user?: User;
}> {
  const token = await getAuthToken();
  if (!token) return { success: false, message: 'Not authenticated' };

  const res = await fetch(`${API_BASE_URL}/vendor/profile/avatar`, {
    method: 'DELETE',
    headers: { Authorization: `JWT ${token}` },
    cache: 'no-store',
  });
  const data = await readJson(res);
  if (!res.ok) return { success: false, message: extractError(data, 'Failed to remove picture') };
  const user = (data.user as unknown as User) || undefined;
  return { success: true, message: String((data as any).message || 'Profile picture removed'), user };
}
