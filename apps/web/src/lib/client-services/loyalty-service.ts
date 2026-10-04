"use client";

/**
 * Thin client façade over loyalty server actions (BFF pattern).
 * The browser never holds the service key and never queries raw
 * collections — it calls server actions, which own user resolution
 * and CMS aggregation.
 */

import {
  claimAchievementAction,
  getLoyaltyCatalog,
  getLoyaltyHistory,
  getLoyaltySummary,
  getMembership,
  redeemRewardAction,
} from '@/app/actions/loyalty';

export async function fetchLoyaltySummary() {
  return getLoyaltySummary();
}

export async function fetchLoyaltyHistory(input: {
  type?: string;
  page?: number;
  limit?: number;
} = {}) {
  return getLoyaltyHistory(input);
}

export async function fetchLoyaltyCatalog(category?: string) {
  return getLoyaltyCatalog(category);
}

export async function fetchMembership() {
  return getMembership();
}

// Pending redeem promises by reward — see redeemReward below.
const redeemKeysInFlight = new Map<string, Promise<{ redemptionId: string | number; newBalance: number; claimId: string | number | null; cost: number }>>();

export async function redeemReward(rewardId: string | number) {
  // Stable key per reward until settled (§4 idempotency): a fresh UUID per
  // click defeats the server dup-check, so a double-tap burns twice. Reuse
  // the pending key for the same reward; mint only when none is in flight.
  const key = String(rewardId);
  const pending = redeemKeysInFlight.get(key);
  if (pending) return pending;
  const idempotencyKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const p = (async () => {
    try {
      return await redeemRewardAction(rewardId, idempotencyKey);
    } finally {
      redeemKeysInFlight.delete(key);
    }
  })();
  redeemKeysInFlight.set(key, p);
  return p;
}

export async function claimAchievement(achievementId: string | number) {
  return claimAchievementAction(achievementId);
}
