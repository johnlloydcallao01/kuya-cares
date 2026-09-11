'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS, SHARED_QUERY_DEFAULTS } from '@encreasl/client-services';

export type TransactionDoc = {
  id: number;
  payment_intent_id: string | null;
  payment_method: string | null;
  amount: number;
  currency: string;
  status: string;
  paid_at: string | null;
  createdAt: string;
  updatedAt: string;
  isPaid: boolean;
  order: {
    id: number;
    status: string;
    total: number;
    subtotal: number;
    delivery_fee: number;
    platform_fee: number;
    fulfillment_type: string;
    placed_at: string | null;
    lalamove_order_id: string | null;
    delivery_status: string;
    merchant: {
      id: number;
      outletName: string;
      outletCode: string;
      isActive: boolean | null;
      vendor: {
        id: number;
        businessName: string;
        logo: { id: number; url: string | null; filename: string | null } | null;
      } | null;
    } | null;
    customer: {
      id: number;
      email: string;
      user: { id: number; email: string; firstName: string; lastName: string; phone: string | null } | null;
    } | null;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type TransactionPagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

export type TransactionStats = {
  totalAll: number;
  filteredTotal: number;
  statusBreakdown: Record<string, number>;
  paymentMethodBreakdown: Record<string, number>;
  totalRevenue: number;
  totalRefunded: number;
  totalFailed: number;
  totalPendingAmount: number;
  netRevenue: number;
  avgTransactionAmount: number;
  paidCount: number;
  pendingCount: number;
  failedCount: number;
  refundedCount: number;
};

export type TransactionsResponse = {
  docs: TransactionDoc[];
  pagination: TransactionPagination | null;
  stats: TransactionStats | null;
};

async function fetchTransactions(qs: string, signal?: AbortSignal): Promise<TransactionsResponse> {
  const res = await fetch(`/api/transactions?${qs}`, { signal });
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text);
      throw new Error(j.error || 'Failed to load transactions');
    } catch {
      throw new Error(text || 'Failed to load transactions');
    }
  }
  return res.json() as Promise<TransactionsResponse>;
}

/**
 * Transactions list query — 3-min instant-back.
 * Query key encodes page, limit, sort, search, and filters.
 */
export function useTransactions(qs: string) {
  return useQuery({
    queryKey: QUERY_KEYS.adminTransactions(qs),
    queryFn: ({ signal }) => fetchTransactions(qs, signal),
    placeholderData: keepPreviousData,
    ...SHARED_QUERY_DEFAULTS,
  });
}