"use client";

/**
 * Real account overview for web /menu — ported 1:1 from
 * apps/mobile-customer/src/services/account.ts (AccountScreen data layer).
 *
 * Same 6 CMS reads, same shapes:
 * - customers?where[user] depth=2 (active delivery address)
 * - orders?where[customer.user] (count + total spent)
 * - wishlists?where[user] (favorites count)
 * - reviews?where[customer.user] (reviews count)
 * - addresses?where[user] (saved address count)
 * - user-notifications?where[user]+status=unread (unread count)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';
const API_KEY = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || '';

export interface AccountStats {
  orderCount: number;
  totalSpent: number;
  favoriteCount: number;
  reviewCount: number;
  addressCount: number;
  unreadNotificationCount: number;
}

export interface AccountOverview {
  customer: any | null;
  stats: AccountStats;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) {
    headers['Authorization'] = `users API-Key ${API_KEY}`;
  }
  return headers;
}

async function fetchDocs(url: string): Promise<{ docs: any[]; totalDocs: number }> {
  const res = await fetch(url, { headers: buildHeaders(), cache: 'no-store', credentials: 'omit' });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  return {
    docs: Array.isArray(data?.docs) ? data.docs : [],
    totalDocs: Number(data?.totalDocs) || 0,
  };
}

export function asObject(value: any): any | null {
  if (!value) return null;
  return typeof value === 'object' ? value : null;
}

type DocsResult = { docs: any[]; totalDocs: number };

const EMPTY_RESULT: DocsResult = { docs: [], totalDocs: 0 };

function settledValue(
  result: PromiseSettledResult<DocsResult>,
  fallback: DocsResult = EMPTY_RESULT,
): DocsResult {
  return result.status === 'fulfilled' ? result.value : fallback;
}

export async function fetchAccountOverview(userId: string | number): Promise<AccountOverview> {
  // Member-safe: one leg 403/500 must not kill all stats. Each leg settles
  // independently; user-scoped legs (wishlists/addresses/notifications) stay
  // live even when no customer doc exists (members).
  const results = await Promise.allSettled([
    fetchDocs(`${API_BASE}/customers?where[user][equals]=${userId}&depth=2&limit=1`),
    fetchDocs(`${API_BASE}/orders?where[customer.user][equals]=${userId}&depth=0&sort=-placed_at&limit=100`),
    fetchDocs(`${API_BASE}/wishlists?where[user][equals]=${userId}&depth=0&limit=1`),
    fetchDocs(`${API_BASE}/reviews?where[customer.user][equals]=${userId}&depth=0&limit=1`),
    fetchDocs(`${API_BASE}/addresses?where[user][equals]=${userId}&depth=0&limit=1`),
    fetchDocs(
      `${API_BASE}/user-notifications?where[user][equals]=${userId}&where[status][equals]=unread&depth=0&limit=1`,
    ),
  ]);

  const customerRes = settledValue(results[0]);
  let ordersRes = settledValue(results[1]);
  const favoritesRes = settledValue(results[2]);
  let reviewsRes = settledValue(results[3]);
  const addressesRes = settledValue(results[4]);
  const unreadRes = settledValue(results[5]);

  const customer = customerRes.docs[0] ?? null;

  // Without a customer doc (members), order/review legs are scoped to
  // customer.user and cannot yield meaningful counts — zero them while
  // keeping wishlists/addresses/notifications live.
  if (!customer) {
    ordersRes = EMPTY_RESULT;
    reviewsRes = EMPTY_RESULT;
  }

  const totalSpent = ordersRes.docs.reduce((sum: number, order: any) => {
    const total = Number(order.total);
    return Number.isFinite(total) ? sum + total : sum;
  }, 0);

  return {
    customer,
    stats: {
      orderCount: ordersRes.totalDocs,
      totalSpent,
      favoriteCount: favoritesRes.totalDocs,
      reviewCount: reviewsRes.totalDocs,
      addressCount: addressesRes.totalDocs,
      unreadNotificationCount: unreadRes.totalDocs,
    },
  };
}

export function formatPHPPrice(value: number): string {
  try {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `₱${Number(value || 0).toFixed(2)}`;
  }
}
