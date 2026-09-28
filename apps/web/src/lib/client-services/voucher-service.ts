"use client";

/**
 * Thin client façade over voucher server actions (BFF pattern).
 * The browser never holds the service key and never queries raw
 * collections — it calls server actions, which own user resolution
 * and CMS aggregation.
 */

import {
  applyBestVoucherAction,
  claimVoucherAction,
  detachVoucherAction,
  getClaimableVouchers,
  getMyVouchers,
} from '@/app/actions/vouchers';
import type { MineFilter } from '@/types/voucher';

export type { MineFilter };

export async function fetchClaimableVouchers(input: {
  merchantId?: string | number;
  featured?: boolean;
  limit?: number;
} = {}) {
  return getClaimableVouchers(input);
}

export async function fetchMyVouchers(filter: MineFilter = 'available') {
  return getMyVouchers(filter);
}

export async function claimVoucher(input: { couponId?: string | number; code?: string }) {
  return claimVoucherAction(input);
}

export async function applyBestVoucher(orderId: string | number) {
  return applyBestVoucherAction(orderId);
}

export async function detachVoucher(orderId: string | number, code?: string) {
  return detachVoucherAction(orderId, code);
}

export async function copyVoucherCode(code: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(code);
    return;
  }
  throw new Error('Copy unavailable');
}
