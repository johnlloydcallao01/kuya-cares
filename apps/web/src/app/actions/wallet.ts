/**
 * @file apps/web/src/app/actions/wallet.ts
 * @description Server-side wallet actions (BFF pattern).
 *
 * The /wallets page calls only these actions. They resolve the signed-in
 * customer server-side via getServerUserId() (depth-0, no hydration), forward to the CMS aggregation
 * endpoint / custom wallet routes with the service key, and return
 * page-ready data. No localStorage reads, no raw collection fetching,
 * no service key in the browser.
 */

'use server';

import type {
  WalletBalance,
  WalletEntryType,
  WalletTransactionUI,
} from '@/types/wallet';
import { getServerUserId } from './auth';

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api').replace(/\/+$/, '');
const SERVICE_KEY = process.env.PAYLOAD_API_KEY || process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || '';

function serviceHeaders(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (SERVICE_KEY) h['Authorization'] = `users API-Key ${SERVICE_KEY}`;
  return h;
}

function toNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapTx(d: any): WalletTransactionUI {
  const created = d.createdAt ? new Date(d.createdAt) : null;
  const ts = created && !Number.isNaN(created.getTime()) ? created.getTime() : 0;
  return {
    id: String(d.id),
    type: d.type as WalletEntryType,
    amount: toNum(d.amount, 0),
    balanceAfter: toNum(d.balanceAfter ?? d.balance_after, 0),
    orderId: d.orderId ?? (typeof d.order === 'object' ? d.order?.id : d.order) ?? null,
    gateway: d.gateway ?? null,
    status: d.status || 'posted',
    createdAt:
      ts > 0
        ? new Date(ts).toLocaleString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : '',
    createdAtTs: ts,
  };
}

export interface WalletSummary {
  customerId: string | number;
  wallet: WalletBalance;
  stats: { toppedUp: number; spent: number; cashback: number; refunded: number; totalDocs: number };
  history: {
    docs: WalletTransactionUI[];
    page: number;
    limit: number;
    totalDocs: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export async function getWalletSummary(input: {
  type?: string;
  page?: number;
  limit?: number;
  q?: string;
} = {}): Promise<WalletSummary> {
  const userId = await getServerUserId();
  if (!userId) throw new Error('WALLET_NO_SESSION');

  const params = new URLSearchParams({ userId: String(userId) });
  if (input.type && input.type !== 'all') params.set('type', input.type);
  params.set('page', String(input.page ?? 1));
  params.set('limit', String(input.limit ?? 20));
  if (input.q) params.set('q', input.q);

  const res = await fetch(`${API_BASE_URL}/wallets/summary?${params.toString()}`, {
    headers: serviceHeaders(),
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404) throw new Error('WALLET_NO_CUSTOMER');
    throw new Error(String(json?.error || `Wallet unavailable (${res.status})`));
  }
  const d = json?.data ?? {};
  return {
    customerId: d.customerId,
    wallet: {
      balance: toNum(d.wallet?.balance, 0),
      currency: d.wallet?.currency || 'PHP',
      status: d.wallet?.status || 'active',
      walletId: d.wallet?.walletId ?? null,
    },
    stats: {
      toppedUp: toNum(d.stats?.toppedUp, 0),
      spent: toNum(d.stats?.spent, 0),
      cashback: toNum(d.stats?.cashback, 0),
      refunded: toNum(d.stats?.refunded, 0),
      totalDocs: toNum(d.stats?.totalDocs, 0),
    },
    history: {
      docs: Array.isArray(d.history?.docs) ? d.history.docs.map(mapTx) : [],
      page: d.history?.pagination?.page ?? 1,
      limit: d.history?.pagination?.limit ?? input.limit ?? 20,
      totalDocs: d.history?.pagination?.totalDocs ?? 0,
      totalPages: d.history?.pagination?.totalPages ?? 1,
      hasNextPage: !!d.history?.pagination?.hasNextPage,
      hasPrevPage: !!d.history?.pagination?.hasPrevPage,
    },
  };
}

export interface TopupIntent {
  topupId: string | number;
  paymentIntentId: string | null;
  clientKey: string | null;
  gateway: string;
}

export async function createWalletTopupAction(input: {
  amount: number;
  gateway?: string;
}): Promise<TopupIntent> {
  // Perf: getWalletSummary re-validates the session — no extra auth hop here.
  const summary = await getWalletSummary({ limit: 1 });
  const res = await fetch(`${API_BASE_URL}/wallet/topup`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({
      customerId: summary.customerId,
      amount: input.amount,
      gateway: input.gateway || 'paymongo',
    }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(data?.error || `Top-up failed (${res.status})`));
  const d = data?.data ?? {};
  const pi = d.paymentIntent?.data ?? d.paymentIntent ?? {};
  return {
    topupId: d.topupId,
    paymentIntentId: pi?.id ? String(pi.id) : null,
    clientKey: pi?.attributes?.client_key ? String(pi.attributes.client_key) : null,
    gateway: d.gateway || 'paymongo',
  };
}

export async function requestWalletWithdrawalAction(input: {
  amount: number;
  destination?: string;
}): Promise<{ entryId: string | number; amount: number }> {
  // Perf: getWalletSummary re-validates the session — no extra auth hop here.
  const summary = await getWalletSummary({ limit: 1 });
  const res = await fetch(`${API_BASE_URL}/wallet/withdraw`, {
    method: 'POST',
    headers: serviceHeaders(),
    body: JSON.stringify({
      customerId: summary.customerId,
      amount: input.amount,
      destination: input.destination || 'manual_review',
    }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(data?.error || `Withdrawal failed (${res.status})`));
  return { entryId: data?.data?.entryId, amount: data?.data?.amount ?? input.amount };
}
