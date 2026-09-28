/**
 * Central voucher domain types for apps/web.
 * Mirrors CMS /api/customer/vouchers/* BFF shapes.
 * @file src/types/voucher.ts
 */

export interface DiscountPreview {
  food: number;
  delivery: number;
  total: number;
}

export interface VoucherUI {
  id: string | number;
  code: string;
  title: string;
  shortCopy?: string | null;
  imageUrl?: string | null;
  discountType: string;
  amount: number;
  maxDiscount?: number | null;
  appliesTo?: string | null;
  freeDelivery: boolean;
  deliveryCap?: number | null;
  minBasket?: number | null;
  maxBasket?: number | null;
  firstOrderOnly: boolean;
  allowedPaymentMethods?: string[] | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  expiresInDays?: number | null;
  isExpired: boolean;
  featured: boolean;
  priority: number;
  vendorName?: string | null;
  usesLeft?: number | null;
  usesLeftForUser?: number | null;
  claimed: boolean;
  claimStatus?: string | null;
  used: boolean;
  discountPreview?: DiscountPreview | null;
}

export interface MyVoucher extends VoucherUI {
  claimId: string | number;
  claimedAt?: string;
  computedStatus: 'available' | 'used' | 'expired';
}

export type MineFilter = 'available' | 'used' | 'expired';

export function discountLabel(v: Pick<VoucherUI, 'discountType' | 'amount' | 'maxDiscount' | 'freeDelivery'>): string {
  if (v.freeDelivery) return 'FREE delivery';
  if (v.discountType === 'percent') {
    const cap = v.maxDiscount ? ` up to ₱${Number(v.maxDiscount).toFixed(0)}` : '';
    return `${Number(v.amount)}% OFF${cap}`;
  }
  return `₱${Number(v.amount).toFixed(2)} OFF`;
}

export function discountIcon(discountType: string, freeDelivery: boolean): string {
  if (freeDelivery) return 'fas fa-motorcycle';
  if (discountType === 'percent') return 'fas fa-percent';
  return 'fas fa-ticket-alt';
}

export function expiryLabel(v: Pick<VoucherUI, 'expiresInDays' | 'expiresAt' | 'isExpired'>): string {
  if (v.isExpired) return 'Expired';
  if (v.expiresInDays == null) return 'No expiry';
  if (v.expiresInDays === 0) return 'Expires today';
  if (v.expiresInDays === 1) return 'Expires tomorrow';
  return `${v.expiresInDays} days left`;
}
