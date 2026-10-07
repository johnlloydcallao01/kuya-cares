/**
 * @file apps/web/src/app/actions/vouchers.ts
 * @description Server-side voucher actions (BFF pattern).
 *
 * The /vouchers page calls only these actions. They resolve the signed-in
 * customer server-side via getServerUserId() (depth-0, no hydration),
 * forward to the CMS customer voucher BFF with the service key, and
 * return page-ready data. No localStorage, no raw collection fetching,
 * no service key in the browser.
 */

'use server';

import type { MineFilter, MyVoucher, VoucherUI } from '@/types/voucher';
import { getServerUserId } from './auth';

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

function throwIfNoCustomer(res: Response, json: any): void {
  const code = json?.code ?? json?.data?.code;
  if (res.status === 404 && (code === 'NO_CUSTOMER' || code == null)) {
    throw new Error('VOUCHERS_NO_CUSTOMER');
  }
}

function mapVoucher(d: any): VoucherUI {
  return {
    id: d.id,
    code: d.code,
    title: d.title || d.code,
    shortCopy: d.shortCopy ?? null,
    imageUrl: d.imageUrl ?? null,
    discountType: d.discountType,
    amount: Number(d.amount ?? 0),
    maxDiscount: d.maxDiscount ?? null,
    appliesTo: d.appliesTo ?? null,
    freeDelivery: !!d.freeDelivery,
    deliveryCap: d.deliveryCap ?? null,
    minBasket: d.minBasket ?? null,
    maxBasket: d.maxBasket ?? null,
    firstOrderOnly: !!d.firstOrderOnly,
    allowedPaymentMethods: d.allowedPaymentMethods ?? null,
    startsAt: d.startsAt ?? null,
    expiresAt: d.expiresAt ?? null,
    expiresInDays: d.expiresInDays ?? null,
    isExpired: !!d.isExpired,
    featured: !!d.featured,
    priority: Number(d.priority ?? 0),
    vendorName: d.vendorName ?? null,
    usesLeft: d.usesLeft ?? null,
    usesLeftForUser: d.usesLeftForUser ?? null,
    claimed: !!d.claimed,
    claimStatus: d.claimStatus ?? null,
    used: !!d.used,
    discountPreview: d.discountPreview ?? null,
  };
}

export async function getClaimableVouchers(input: {
  merchantId?: string | number;
  featured?: boolean;
  limit?: number;
} = {}): Promise<VoucherUI[]> {
  const userId = await getServerUserId();
  if (!userId) throw new Error('VOUCHERS_NO_SESSION');

  const params = new URLSearchParams({ userId: String(userId) });
  if (input.merchantId != null) params.set('merchantId', String(input.merchantId));
  if (input.featured) params.set('featured', 'true');
  params.set('limit', String(input.limit ?? 50));

  const res = await fetch(`${API_BASE_URL}/customer/vouchers/claimable?${params.toString()}`, {
    headers: serviceHeaders(),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) {
    throwIfNoCustomer(res, json);
    throw new Error(String(json?.error || `Vouchers unavailable (${res.status})`));
  }
  return Array.isArray(json?.data) ? json.data.map(mapVoucher) : [];
}

export async function getMyVouchers(filter: MineFilter | 'all' = 'available'): Promise<MyVoucher[]> {
  const userId = await getServerUserId();
  if (!userId) throw new Error('VOUCHERS_NO_SESSION');

  const params = new URLSearchParams({ userId: String(userId), filter });
  const res = await fetch(`${API_BASE_URL}/customer/vouchers/mine?${params.toString()}`, {
    headers: serviceHeaders(),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) {
    throwIfNoCustomer(res, json);
    throw new Error(String(json?.error || `Vouchers unavailable (${res.status})`));
  }
  return Array.isArray(json?.data)
    ? json.data.map((d: any) => ({
        ...mapVoucher(d),
        claimId: d.claimId,
        claimedAt: d.claimedAt,
        computedStatus: d.computedStatus as MineFilter,
      }))
    : [];
}

export async function claimVoucherAction(input: {
  couponId?: string | number;
  code?: string;
}): Promise<VoucherUI> {
  const userId = await getServerUserId();
  if (!userId) throw new Error('VOUCHERS_NO_SESSION');

  const res = await fetch(`${API_BASE_URL}/customer/vouchers/claim`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ userId: String(userId), couponId: input.couponId, code: input.code }),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) {
    throwIfNoCustomer(res, json);
    throw new Error(String(json?.error || `Claim failed (${res.status})`));
  }
  return mapVoucher(json?.data ?? {});
}

/** Checkout-scoped: apply the best voucher to a pending order. */
export async function applyBestVoucherAction(orderId: string | number) {
  const userId = await getServerUserId();
  if (!userId) throw new Error('VOUCHERS_NO_SESSION');

  const res = await fetch(`${API_BASE_URL}/customer/vouchers/apply-best`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ userId: String(userId), orderId: String(orderId) }),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) {
    throwIfNoCustomer(res, json);
    throw new Error(String(json?.error || `Apply failed (${res.status})`));
  }
  return json?.data as {
    code: string;
    foodDiscount: number;
    deliveryDiscount: number;
    totalDiscount: number;
    orderTotal: number;
  };
}

/** Checkout-scoped: detach a voucher from a pending order. */
export async function detachVoucherAction(orderId: string | number, code?: string) {
  const userId = await getServerUserId();
  if (!userId) throw new Error('VOUCHERS_NO_SESSION');

  const res = await fetch(`${API_BASE_URL}/customer/vouchers/detach`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ userId: String(userId), orderId: String(orderId), code }),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) {
    throwIfNoCustomer(res, json);
    throw new Error(String(json?.error || `Detach failed (${res.status})`));
  }
  return json?.data as { removed: string[]; removedTotal: number; discountTotal: number; orderTotal: number };
}
