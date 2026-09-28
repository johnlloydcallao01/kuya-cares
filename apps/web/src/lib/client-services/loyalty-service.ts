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

export async function redeemReward(rewardId: string | number) {
  // Per-click idempotency: safe retries never double-burn.
  const key =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return redeemRewardAction(rewardId, key);
}

export async function claimAchievement(achievementId: string | number) {
  return claimAchievementAction(achievementId);
}
