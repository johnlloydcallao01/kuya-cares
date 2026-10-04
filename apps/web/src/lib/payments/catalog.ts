'use client';

/**
 * Shared payment-method catalog for apps/web.
 *
 * The AUTHORITATIVE list comes from `GET /api/payments/options` (CMS) —
 * screens must fetch it via `getPaymentOptions()` and never maintain their
 * own method arrays. This module only owns PRESENTATION data (local logo
 * assets per method id) plus the offline FALLBACK list used when the API is
 * unreachable. Logo SVGs are brand marks, not API data, so they stay here.
 */

export type PaymentMethodId =
  | 'card'
  | 'gcash'
  | 'grab_pay'
  | 'paymaya'
  | 'billease'
  | 'dob'
  | 'brankas'
  | 'qrph';

export interface PaymentMethodOption {
  id: PaymentMethodId;
  /** Display label — authoritative value arrives from the API. */
  label: string;
  hint?: string;
}

interface LogoEntry {
  srcs: { src: string; alt: string }[];
  alt: string;
}

const LOGOS: Record<PaymentMethodId, LogoEntry> = {
  card: {
    srcs: [
      { src: '/payment-logos/visa.svg', alt: 'Visa' },
      { src: '/payment-logos/mastercard.svg', alt: 'Mastercard' },
    ],
    alt: 'Cards',
  },
  gcash: { srcs: [{ src: '/payment-logos/gcash.svg', alt: 'GCash' }], alt: 'GCash' },
  grab_pay: { srcs: [{ src: '/payment-logos/grabpay.svg', alt: 'GrabPay' }], alt: 'GrabPay' },
  paymaya: { srcs: [{ src: '/payment-logos/maya.svg', alt: 'Maya' }], alt: 'Maya' },
  billease: { srcs: [{ src: '/payment-logos/billease.svg', alt: 'BillEase' }], alt: 'BillEase' },
  dob: {
    srcs: [
      { src: '/payment-logos/bpi.svg', alt: 'BPI' },
      { src: '/payment-logos/unionbank.svg', alt: 'UnionBank' },
    ],
    alt: 'Online Banking',
  },
  brankas: {
    srcs: [
      { src: '/payment-logos/bdo.svg', alt: 'BDO' },
      { src: '/payment-logos/metrobank.svg', alt: 'Metrobank' },
      { src: '/payment-logos/landbank.svg', alt: 'LandBank' },
    ],
    alt: 'Online Banking',
  },
  qrph: { srcs: [{ src: '/payment-logos/qrph.svg', alt: 'QR Ph' }], alt: 'QR Ph' },
};

export function logosFor(methodId: string): LogoEntry {
  return (
    (LOGOS as Record<string, LogoEntry>)[methodId] ?? { srcs: [], alt: methodId }
  );
}

/**
 * Offline fallback — mirrors the CMS canonical set. Used ONLY when
 * `getPaymentOptions()` fails (CMS unreachable); the API is authoritative
 * whenever it responds.
 */
export const FALLBACK_PAYMENT_METHODS: PaymentMethodOption[] = [
  { id: 'card', label: 'Cards (Visa/Mastercard)', hint: 'Credit & debit cards' },
  { id: 'gcash', label: 'GCash', hint: 'GCash e-wallet' },
  { id: 'grab_pay', label: 'GrabPay', hint: 'GrabPay e-wallet' },
  { id: 'paymaya', label: 'Maya', hint: 'Maya e-wallet' },
  { id: 'billease', label: 'BillEase (BNPL)', hint: 'Buy now, pay later' },
  { id: 'dob', label: 'Online Banking (BPI/UBP)', hint: 'BPI or UnionBank' },
  { id: 'brankas', label: 'Online Banking (BDO/Metrobank/LandBank)', hint: 'BDO, Metrobank or LandBank' },
  { id: 'qrph', label: 'QR Ph', hint: 'Any QR Ph app' },
];
