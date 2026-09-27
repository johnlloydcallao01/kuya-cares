"use client";

/**
 * Thin client façade over wallet server actions (BFF pattern).
 * The browser never holds the service key and never queries raw
 * collections — it calls server actions, which own user resolution
 * and CMS aggregation. PayMongo.js helpers stay client-side because
 * they talk to PayMongo's public API directly (publishable key only).
 */

import {
  createWalletTopupAction,
  getWalletSummary,
  requestWalletWithdrawalAction,
  type TopupIntent,
  type WalletSummary,
} from '@/app/actions/wallet';

export type { TopupIntent, WalletSummary };

export async function fetchWalletSummary(input: {
  type?: string;
  page?: number;
  limit?: number;
  q?: string;
} = {}): Promise<WalletSummary> {
  return getWalletSummary(input);
}

export async function requestTopup(input: {
  amount: number;
  gateway?: string;
}): Promise<TopupIntent> {
  return createWalletTopupAction(input);
}

export async function requestWithdrawal(input: {
  amount: number;
  destination?: string;
}): Promise<{ entryId: string | number; amount: number }> {
  return requestWalletWithdrawalAction(input);
}

/** Direct PayMongo client helpers (same pattern as checkout page). */
export async function createPaymongoPaymentMethod(input: {
  type: string;
  name: string;
  email: string;
  card?: { number: string; expMonth: number; expYear: number; cvc: string };
}): Promise<string> {
  const pk = process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY_LIVE;
  if (!pk) throw new Error('Missing PayMongo public key');
  const payload: any = {
    data: {
      attributes: {
        type: input.type,
        billing: {
          name: input.name,
          email: input.email,
          address: { line1: '', city: '', country: 'PH' },
        },
      },
    },
  };
  if (input.type === 'card' && input.card) {
    payload.data.attributes.details = {
      card_number: input.card.number.replace(/\D/g, ''),
      exp_month: input.card.expMonth,
      exp_year: input.card.expYear,
      cvc: input.card.cvc.replace(/\D/g, ''),
    };
  }
  const resp = await fetch('https://api.paymongo.com/v1/payment_methods', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${window.btoa(pk + ':')}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.errors?.[0]?.detail || 'Failed to create payment method');
  if (!data?.data?.id) throw new Error('Missing payment method from PayMongo');
  return String(data.data.id);
}

export type AttachResult =
  | { kind: 'redirect'; url: string }
  | { kind: 'qr'; imageUrl: string }
  | { kind: 'succeeded' }
  | { kind: 'processing' };

export async function attachPaymongoMethod(input: {
  paymentMethodId: string;
  intentId: string;
  clientKey: string;
  returnUrl: string;
}): Promise<AttachResult> {
  const pk = process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY_LIVE;
  if (!pk) throw new Error('Missing PayMongo public key');
  const resp = await fetch(`https://api.paymongo.com/v1/payment_intents/${input.intentId}/attach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${window.btoa(pk + ':')}`,
    },
    body: JSON.stringify({
      data: {
        attributes: {
          client_key: input.clientKey,
          payment_method: input.paymentMethodId,
          return_url: input.returnUrl,
        },
      },
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.errors?.[0]?.detail || 'Failed to attach payment method');
  const attrs = data?.data?.attributes || {};
  if (attrs.status === 'awaiting_next_action' && attrs.next_action) {
    if (attrs.next_action?.redirect?.url) return { kind: 'redirect', url: attrs.next_action.redirect.url };
    if (attrs.next_action?.code?.image_url) return { kind: 'qr', imageUrl: attrs.next_action.code.image_url };
  }
  if (attrs.status === 'succeeded') return { kind: 'succeeded' };
  return { kind: 'processing' };
}
