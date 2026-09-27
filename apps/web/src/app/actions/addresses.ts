/**
 * @file apps/web/src/app/actions/addresses.ts
 * @description Server-side address-book actions (BFF pattern).
 *
 * The /addresses page calls only these actions. They resolve the signed-in
 * customer server-side via getServerUser(), forward to the CMS aggregation
 * endpoint /api/addresses/book/..., and return page-ready data.
 * No localStorage reads, no raw collection fetching, no service key
 * in the browser.
 */

'use server';

import type { AddressBook, AddressUI } from '@/types/address';
import { getServerUser } from './auth';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');
const SERVICE_KEY = process.env.PAYLOAD_API_KEY || process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || '';

function serviceHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (SERVICE_KEY) h['Authorization'] = `users API-Key ${SERVICE_KEY}`;
  return h;
}

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function mapAddress(d: any, activeId: string | null): AddressUI {
  return {
    id: String(d.id),
    formattedAddress: d.formattedAddress ?? d.formatted_address ?? '',
    street: d.street ?? null,
    floorUnitRoom: d.floorUnitRoom ?? d.floor_unit_room ?? null,
    deliveryInstructions: d.deliveryInstructions ?? d.delivery_instructions ?? null,
    label: d.label ?? null,
    addressType: d.addressType ?? d.address_type ?? 'home',
    barangay: d.barangay ?? null,
    locality: d.locality ?? null,
    province: d.province ?? d.administrative_area_level_1 ?? null,
    postalCode: d.postalCode ?? d.postal_code ?? null,
    country: d.country ?? null,
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    isDefault: !!(d.isDefault ?? d.is_default),
    isVerified: !!(d.isVerified ?? d.is_verified),
    isActive: activeId != null ? String(d.id) === String(activeId) : !!(d.isActive ?? d.is_active),
    createdAt: d.createdAt ?? d.createdAt,
  };
}

export async function getAddressBook(input: {
  q?: string;
  type?: string;
  page?: number;
  limit?: number;
} = {}): Promise<AddressBook> {
  const user = await getServerUser();
  if (!user) throw new Error('ADDRESSES_NO_SESSION');

  const params = new URLSearchParams({ userId: String(user.id) });
  if (input.q) params.set('q', input.q);
  if (input.type && input.type !== 'all') params.set('type', input.type);
  params.set('page', String(input.page ?? 1));
  params.set('limit', String(input.limit ?? 50));

  const res = await fetch(`${API_BASE_URL}/addresses/book?${params.toString()}`, {
    headers: serviceHeaders(),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) {
    if (res.status === 404) throw new Error('ADDRESSES_NO_CUSTOMER');
    throw new Error(String(json?.error || `Addresses unavailable (${res.status})`));
  }
  const d = json?.data ?? {};
  const activeId = d.activeAddressId != null ? String(d.activeAddressId) : null;
  const addresses = Array.isArray(d.addresses) ? d.addresses.map((a: any) => mapAddress(a, activeId)) : [];
  addresses.sort((a: AddressUI, b: AddressUI) => Number(b.isActive) - Number(a.isActive));
  return {
    customerId: d.customerId,
    activeAddressId: activeId,
    activeAddress: addresses.find((a: AddressUI) => a.isActive) ?? null,
    addresses,
    stats: {
      total: Number(d.stats?.total ?? addresses.length),
      home: Number(d.stats?.home ?? 0),
      work: Number(d.stats?.work ?? 0),
      verified: Number(d.stats?.verified ?? 0),
    },
  };
}

export interface AddressInput {
  formatted_address: string;
  google_place_id?: string;
  latitude?: number | null;
  longitude?: number | null;
  street?: string;
  floor_unit_room?: string;
  delivery_instructions?: string;
  label?: string;
  address_type?: string;
  barangay?: string;
  locality?: string;
  administrative_area_level_1?: string;
  postal_code?: string;
  is_default?: boolean;
  setActive?: boolean;
}

export async function createAddressAction(input: AddressInput): Promise<{ address: AddressUI; activeAddressId: string | null }> {
  const user = await getServerUser();
  if (!user) throw new Error('ADDRESSES_NO_SESSION');

  const res = await fetch(`${API_BASE_URL}/addresses/book`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ ...input, userId: String(user.id) }),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Create failed (${res.status})`));
  const activeId = json?.data?.activeAddressId != null ? String(json.data.activeAddressId) : null;
  return { address: mapAddress(json?.data?.address ?? {}, activeId), activeAddressId: activeId };
}

export async function updateAddressAction(
  id: string | number,
  input: Partial<AddressInput>,
): Promise<{ address: any }> {
  const user = await getServerUser();
  if (!user) throw new Error('ADDRESSES_NO_SESSION');

  const res = await fetch(`${API_BASE_URL}/addresses/book/${id}`, {
    method: 'PATCH',
    headers: serviceHeaders(),
    body: JSON.stringify({ ...input, userId: String(user.id) }),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Update failed (${res.status})`));
  return { address: json?.data?.address };
}

export async function deleteAddressAction(id: string | number): Promise<{ deleted: boolean; clearedActive: boolean }> {
  const user = await getServerUser();
  if (!user) throw new Error('ADDRESSES_NO_SESSION');

  const params = new URLSearchParams({ userId: String(user.id) });
  const res = await fetch(`${API_BASE_URL}/addresses/book/${id}?${params.toString()}`, {
    method: 'DELETE',
    headers: serviceHeaders(),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Delete failed (${res.status})`));
  return { deleted: true, clearedActive: !!json?.data?.clearedActive };
}

export async function setActiveAddressAction(addressId: string | number): Promise<{ activeAddressId: string }> {
  const user = await getServerUser();
  if (!user) throw new Error('ADDRESSES_NO_SESSION');

  const res = await fetch(`${API_BASE_URL}/addresses/book/active`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ userId: String(user.id), addressId: String(addressId) }),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Set active failed (${res.status})`));
  return { activeAddressId: String(json?.data?.activeAddressId ?? addressId) };
}
