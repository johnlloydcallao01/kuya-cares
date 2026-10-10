/**
 * Central wallet domain types for apps/web.
 * Mirrors CMS `wallets`, `wallet-transactions`, `wallet-topups` collections.
 * @file src/types/wallet.ts
 */

export type WalletEntryType =
  | 'topup'
  | 'payment'
  | 'refund'
  | 'cashback'
  | 'withdrawal'
  | 'adjustment'
  | 'expiry';

export type WalletStatus = 'active' | 'frozen' | 'closed';

export interface WalletBalance {
  balance: number;
  currency: string;
  status: WalletStatus;
  walletId: number | string | null;
}

export interface WalletTransactionUI {
  id: string;
  type: WalletEntryType;
  amount: number;
  balanceAfter: number;
  orderId?: string | number | null;
  gateway?: string | null;
  status: string;
  createdAt: string;
  createdAtTs: number;
}

export interface WalletHistoryResult {
  docs: WalletTransactionUI[];
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export const WALLET_ENTRY_TYPES: WalletEntryType[] = [
  'topup',
  'payment',
  'refund',
  'cashback',
  'withdrawal',
  'adjustment',
  'expiry',
];

export interface EntryMeta {
  label: string;
  /** text color for signed amount */
  amountClass: string;
  pill: string;
  icon: string;
  /** +1 credit | -1 debit | 0 neutral */
  direction: 1 | -1 | 0;
}

export const WALLET_ENTRY_META: Record<WalletEntryType, EntryMeta> = {
  topup: {
    label: 'Top-up',
    amountClass: 'text-green-700 dark:text-green-400',
    pill: 'bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-900',
    icon: 'fas fa-arrow-down',
    direction: 1,
  },
  payment: {
    label: 'Payment',
    amountClass: 'text-gray-900 dark:text-white',
    pill: 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900',
    icon: 'fas fa-receipt',
    direction: -1,
  },
  refund: {
    label: 'Refund',
    amountClass: 'text-green-700 dark:text-green-400',
    pill: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900',
    icon: 'fas fa-undo',
    direction: 1,
  },
  cashback: {
    label: 'Cashback',
    amountClass: 'text-amber-700 dark:text-amber-400',
    pill: 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900',
    icon: 'fas fa-coins',
    direction: 1,
  },
  withdrawal: {
    label: 'Withdrawal',
    amountClass: 'text-gray-900 dark:text-white',
    pill: 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-900',
    icon: 'fas fa-arrow-up',
    direction: -1,
  },
  adjustment: {
    label: 'Adjustment',
    amountClass: 'text-gray-700 dark:text-gray-300',
    pill: 'bg-gray-100 dark:bg-[#242424] text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-[#383838]',
    icon: 'fas fa-sliders-h',
    direction: 0,
  },
  expiry: {
    label: 'Expired',
    amountClass: 'text-red-600 dark:text-red-400',
    pill: 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900',
    icon: 'fas fa-hourglass-end',
    direction: -1,
  },
};

export function getEntryMeta(type: string): EntryMeta {
  return (
    (WALLET_ENTRY_META as Record<string, EntryMeta>)[type] ?? {
      label: String(type).replace(/_/g, ' '),
      amountClass: 'text-gray-700',
      pill: 'bg-gray-100 text-gray-700 border border-gray-200',
      icon: 'fas fa-circle',
      direction: 0 as const,
    }
  );
}

const signedPhpFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatSignedPHP(amount: number): string {
  const sign = amount > 0 ? '+' : amount < 0 ? '−' : '';
  const abs = Math.abs(amount);
  return `${sign}₱${signedPhpFormatter.format(abs)}`;
}

export type TopupMethod = 'card' | 'gcash' | 'grab_pay' | 'paymaya' | 'qrph';

export const TOPUP_METHODS: { id: TopupMethod; label: string; icon: string }[] = [
  { id: 'card', label: 'Card', icon: 'fas fa-credit-card' },
  { id: 'gcash', label: 'GCash', icon: 'fas fa-mobile-alt' },
  { id: 'grab_pay', label: 'GrabPay', icon: 'fas fa-wallet' },
  { id: 'paymaya', label: 'Maya', icon: 'fas fa-money-bill-wave' },
  { id: 'qrph', label: 'QR Ph', icon: 'fas fa-qrcode' },
];
