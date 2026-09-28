/**
 * @file apps/web/src/app/actions/loyalty.ts
 * @description Server-side loyalty actions (BFF pattern).
 *
 * The /points page calls only these actions. They resolve the signed-in
 * customer server-side via getServerUserId() (depth-0, no hydration),
 * forward to the CMS loyalty BFF with the service key, and return
 * page-ready data. No localStorage, no raw collection fetching,
 * no service key in the browser.
 */

'use server';

import type {
  AchievementUI,
  EarnRule,
  LoyaltySummary,
  PointsEntry,
  RewardUI,
  TierInfo,
} from '@/types/loyalty';
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

function mapEntry(d: any): PointsEntry {
  return {
    id: d.id,
    type: d.type,
    points: Math.floor(Number(d.points ?? 0)),
    pointsAfter: Math.floor(Number(d.pointsAfter ?? d.points_after ?? 0)),
    orderId: d.orderId ?? null,
    expiresAt: d.expiresAt ?? null,
    createdAt: d.createdAt,
  };
}

export async function getLoyaltySummary(): Promise<LoyaltySummary> {
  const userId = await getServerUserId();
  if (!userId) throw new Error('LOYALTY_NO_SESSION');

  const params = new URLSearchParams({ userId: String(userId) });
  const res = await fetch(`${API_BASE_URL}/customer/loyalty/summary?${params.toString()}`, {
    headers: serviceHeaders(),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Loyalty unavailable (${res.status})`));
  const d = json?.data ?? {};
  return {
    customerId: d.customerId,
    balance: Math.floor(Number(d.balance ?? 0)),
    lifetimeEarned: Math.floor(Number(d.lifetimeEarned ?? 0)),
    lifetimeRedeemed: Math.floor(Number(d.lifetimeRedeemed ?? 0)),
    thisMonthEarned: Math.floor(Number(d.thisMonthEarned ?? 0)),
    tier: d.tier as TierInfo,
    recent: Array.isArray(d.recent) ? d.recent.map(mapEntry) : [],
  };
}

export async function getLoyaltyHistory(input: {
  type?: string;
  page?: number;
  limit?: number;
} = {}) {
  const userId = await getServerUserId();
  if (!userId) throw new Error('LOYALTY_NO_SESSION');

  const params = new URLSearchParams({ userId: String(userId) });
  if (input.type && input.type !== 'all') params.set('type', input.type);
  params.set('page', String(input.page ?? 1));
  params.set('limit', String(input.limit ?? 20));

  const res = await fetch(`${API_BASE_URL}/customer/loyalty/history?${params.toString()}`, {
    headers: serviceHeaders(),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `History unavailable (${res.status})`));
  const d = json?.data ?? {};
  const p = d.pagination ?? {};
  return {
    docs: Array.isArray(d.docs) ? d.docs.map(mapEntry) : [],
    page: p.page ?? 1,
    totalPages: p.totalPages ?? 1,
    hasNextPage: !!p.hasNextPage,
  };
}

export async function getLoyaltyCatalog(category?: string): Promise<{
  pointsBalance: number;
  earnRules: EarnRule[];
  rewards: RewardUI[];
  achievements: AchievementUI[];
}> {
  const userId = await getServerUserId();
  if (!userId) throw new Error('LOYALTY_NO_SESSION');

  const params = new URLSearchParams({ userId: String(userId) });
  if (category && category !== 'all') params.set('category', category);
  const res = await fetch(`${API_BASE_URL}/customer/loyalty/catalog?${params.toString()}`, {
    headers: serviceHeaders(),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Catalog unavailable (${res.status})`));
  const d = json?.data ?? {};
  return {
    pointsBalance: Math.floor(Number(d.pointsBalance ?? 0)),
    earnRules: d.earnRules ?? [],
    rewards: d.rewards ?? [],
    achievements: d.achievements ?? [],
  };
}

export async function redeemRewardAction(rewardId: string | number, idempotencyKey?: string) {
  const userId = await getServerUserId();
  if (!userId) throw new Error('LOYALTY_NO_SESSION');

  const res = await fetch(`${API_BASE_URL}/customer/loyalty/redeem`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ userId: String(userId), rewardId: String(rewardId), idempotencyKey }),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Redeem failed (${res.status})`));
  return json?.data as { redemptionId: string | number; newBalance: number; claimId: string | number | null; cost: number };
}

export async function claimAchievementAction(achievementId: string | number) {
  const userId = await getServerUserId();
  if (!userId) throw new Error('LOYALTY_NO_SESSION');

  const res = await fetch(`${API_BASE_URL}/customer/loyalty/achievements`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({ userId: String(userId), achievementId: String(achievementId) }),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Claim failed (${res.status})`));
  return json?.data as { granted: number; newBalance: number; entryId: string | number };
}

export async function getMembership() {
  const userId = await getServerUserId();
  if (!userId) throw new Error('LOYALTY_NO_SESSION');

  const params = new URLSearchParams({ userId: String(userId) });
  const res = await fetch(`${API_BASE_URL}/customer/loyalty/membership?${params.toString()}`, {
    headers: serviceHeaders(),
    cache: 'no-store',
  });
  const json = await readJson(res);
  if (!res.ok) throw new Error(String(json?.error || `Membership unavailable (${res.status})`));
  return json?.data;
}
