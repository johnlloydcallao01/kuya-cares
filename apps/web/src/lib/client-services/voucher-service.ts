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

export async function fetchMyVouchers(filter: MineFilter | 'all' = 'available') {
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
    try {
      await navigator.clipboard.writeText(code);
      return;
    } catch {
      // HTTP/non-secure contexts reject clipboard API — fall through.
    }
  }
  // Legacy fallback for clipboard-less contexts.
  if (typeof document !== 'undefined') {
    const ta = document.createElement('textarea');
    ta.value = code;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      if (document.execCommand('copy')) {
        document.body.removeChild(ta);
        return;
      }
    } catch {
      // fall through to throw below
    }
    document.body.removeChild(ta);
  }
  throw new Error('Copy unavailable');
}
