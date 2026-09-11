import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiConfig } from '../config/environment';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildCmsHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  Authorization: `users API-Key ${apiConfig.payloadApiKey}`,
});

type TransactionDoc = {
  id: string | number;
  status?: string;
  paid_at?: string | null;
  payment_intent_id?: string | null;
  order?: string | number | { id?: string | number } | null;
};

type OrderDoc = {
  id: string | number;
  status?: string;
};

export type PendingCheckoutSession = {
  customerId: string;
  merchantId: string;
  orderId: string;
  paymentIntentId: string;
  createdAt: string;
};

export type CheckoutPaymentStatus =
  | { status: 'none' }
  | { status: 'pending'; orderId?: string; paymentIntentId?: string }
  | { status: 'failed'; orderId?: string; paymentIntentId?: string }
  | {
      status: 'paid';
      orderId: string;
      paymentIntentId?: string;
      transaction?: TransactionDoc;
      paidAt?: string | null;
    };

const pendingCheckoutKey = (customerId: string, merchantId: string) =>
  `tap2go:pending-checkout:${customerId}:${merchantId}`;

export async function waitForPaidTransaction(
  paymentIntentId: string,
  fallbackOrderId?: string,
  attempts = 20,
  intervalMs = 1500,
): Promise<{ transaction: TransactionDoc; orderId: string }> {
  const headers = buildCmsHeaders();

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(
      `${apiConfig.baseUrl}/transactions?where[payment_intent_id][equals]=${paymentIntentId}&depth=1&limit=1`,
      { headers }
    );

    if (response.ok) {
      const data = await response.json();
      const transaction = Array.isArray(data?.docs) ? data.docs[0] : null;

      if (transaction) {
        const status = String(transaction.status || '').toLowerCase();
        const resolvedOrderId = resolveOrderId(transaction.order, fallbackOrderId);

        if (status === 'paid' && resolvedOrderId) {
          return {
            transaction,
            orderId: resolvedOrderId,
          };
        }

        if (status === 'failed') {
          throw new Error('Your payment was not completed.');
        }
      }
    }

    await sleep(intervalMs);
  }

  throw new Error('Payment confirmation is still processing. Please check your Orders shortly.');
}

export async function finalizePaidOrder(orderId: string, paidAt?: string | null): Promise<void> {
  const headers = buildCmsHeaders();
  const orderedAt = paidAt || new Date().toISOString();

  await fetch(`${apiConfig.baseUrl}/orders/${orderId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      status: 'accepted',
    }),
  }).catch(() => undefined);

  const cartItemsResponse = await fetch(
    `${apiConfig.baseUrl}/cart-items?where[order_id][equals]=${orderId}&limit=200&depth=0`,
    { headers }
  );

  if (!cartItemsResponse.ok) {
    return;
  }

  const cartItemsData = await cartItemsResponse.json();
  const cartItems = Array.isArray(cartItemsData?.docs) ? cartItemsData.docs : [];

  await Promise.all(
    cartItems.map((item: any) =>
      fetch(`${apiConfig.baseUrl}/cart-items/${item.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'ordered',
          ordered_at: orderedAt,
        }),
      }).catch(() => undefined)
    )
  );

  // Book the Lalamove delivery now that payment is confirmed.
  try {
    await bookLalamoveDelivery(orderId);
  } catch (err) {
    console.error(`[checkoutReturn] All Lalamove booking attempts failed for order ${orderId}:`, err);
    // Roll back order status — admin must re-trigger delivery booking
    await fetch(`${apiConfig.baseUrl}/orders/${orderId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'pending' }),
    }).catch(() => undefined);
  }
}

/**
 * Books a Lalamove delivery for a paid order via the CMS.
 * Retries up to 3 times with backoff before throwing.
 * Safe to call multiple times — the CMS returns 409 if already booked.
 */
export async function bookLalamoveDelivery(
  orderId: string,
  retries = 3,
  delayMs = 1000,
): Promise<{
  deliveryBookingId: number;
  lalamoveOrderId: string;
  shareLink: string;
  deliveryFee: number;
  status: string;
}> {
  const headers = buildCmsHeaders();

  for (let attempt = 1; attempt <= retries; attempt++) {
    const response = await fetch(`${apiConfig.baseUrl}/delivery/book`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ orderId: Number(orderId) }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      return data?.data;
    }

    const message = data?.error || `Failed to book delivery (${response.status})`;

    if (attempt < retries) {
      console.warn(`[checkoutReturn] Lalamove booking attempt ${attempt}/${retries} failed: ${message}. Retrying in ${delayMs}ms...`);
      await sleep(delayMs);
      delayMs *= 2;
      continue;
    }

    throw new Error(message);
  }

  throw new Error('Failed to book delivery after all retries');
}

export async function savePendingCheckoutSession(session: PendingCheckoutSession): Promise<void> {
  await AsyncStorage.setItem(
    pendingCheckoutKey(session.customerId, session.merchantId),
    JSON.stringify(session),
  );
}

export async function getPendingCheckoutSession(
  customerId: string,
  merchantId: string,
): Promise<PendingCheckoutSession | null> {
  const rawValue = await AsyncStorage.getItem(pendingCheckoutKey(customerId, merchantId));
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as PendingCheckoutSession;
  } catch {
    await AsyncStorage.removeItem(pendingCheckoutKey(customerId, merchantId));
    return null;
  }
}

export async function clearPendingCheckoutSession(
  customerId: string,
  merchantId: string,
): Promise<void> {
  await AsyncStorage.removeItem(pendingCheckoutKey(customerId, merchantId));
}

export async function findActiveCartLinkedOrder(
  customerId: string,
  merchantId: string,
): Promise<string | null> {
  const headers = buildCmsHeaders();
  const response = await fetch(
    `${apiConfig.baseUrl}/cart-items?where[customer][equals]=${customerId}&where[merchant][equals]=${merchantId}&where[status][equals]=active&limit=200&depth=0`,
    { headers },
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const docs = Array.isArray(data?.docs) ? data.docs : [];

  for (const doc of docs) {
    const orderId = resolveOrderId(doc?.order_id);
    if (orderId) {
      return orderId;
    }
  }

  return null;
}

export async function getCheckoutPaymentStatus(args: {
  paymentIntentId?: string;
  orderId?: string;
}): Promise<CheckoutPaymentStatus> {
  const headers = buildCmsHeaders();

  let transaction: TransactionDoc | null = null;
  if (args.paymentIntentId) {
    transaction = await fetchTransactionByPaymentIntent(args.paymentIntentId, headers);
  }

  if (!transaction && args.orderId) {
    transaction = await fetchTransactionByOrderId(args.orderId, headers);
  }

  const resolvedOrderId = resolveOrderId(transaction?.order, args.orderId);
  const paymentIntentId = transaction?.payment_intent_id || args.paymentIntentId;
  const transactionStatus = String(transaction?.status || '').toLowerCase();

  if (transactionStatus === 'paid' && resolvedOrderId) {
    return {
      status: 'paid',
      orderId: resolvedOrderId,
      paymentIntentId: paymentIntentId || undefined,
      transaction,
      paidAt: transaction?.paid_at || null,
    };
  }

  if (transactionStatus === 'failed') {
    return {
      status: 'failed',
      orderId: resolvedOrderId || undefined,
      paymentIntentId: paymentIntentId || undefined,
    };
  }

  if (resolvedOrderId) {
    const order = await fetchOrderById(resolvedOrderId, headers);
    const orderStatus = String(order?.status || '').toLowerCase();

    if (isPaidOrderStatus(orderStatus)) {
      return {
        status: 'paid',
        orderId: resolvedOrderId,
        paymentIntentId: paymentIntentId || undefined,
        transaction: transaction || undefined,
        paidAt: transaction?.paid_at || null,
      };
    }

    if (orderStatus === 'cancelled') {
      return {
        status: 'failed',
        orderId: resolvedOrderId,
        paymentIntentId: paymentIntentId || undefined,
      };
    }
  }

  if (transactionStatus === 'pending' || resolvedOrderId || paymentIntentId) {
    return {
      status: 'pending',
      orderId: resolvedOrderId || undefined,
      paymentIntentId: paymentIntentId || undefined,
    };
  }

  return { status: 'none' };
}

async function fetchTransactionByPaymentIntent(
  paymentIntentId: string,
  headers: Record<string, string>,
): Promise<TransactionDoc | null> {
  const response = await fetch(
    `${apiConfig.baseUrl}/transactions?where[payment_intent_id][equals]=${paymentIntentId}&depth=1&limit=1`,
    { headers },
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return Array.isArray(data?.docs) ? data.docs[0] || null : null;
}

async function fetchTransactionByOrderId(
  orderId: string,
  headers: Record<string, string>,
): Promise<TransactionDoc | null> {
  const response = await fetch(
    `${apiConfig.baseUrl}/transactions?where[order][equals]=${orderId}&depth=1&limit=1&sort=-createdAt`,
    { headers },
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return Array.isArray(data?.docs) ? data.docs[0] || null : null;
}

async function fetchOrderById(
  orderId: string,
  headers: Record<string, string>,
): Promise<OrderDoc | null> {
  const response = await fetch(`${apiConfig.baseUrl}/orders/${orderId}`, { headers });
  if (!response.ok) {
    return null;
  }

  return (await response.json()) as OrderDoc;
}

function isPaidOrderStatus(status: string): boolean {
  return [
    'accepted',
    'preparing',
    'ready_for_pickup',
    'on_delivery',
    'delivered',
  ].includes(status);
}

function resolveOrderId(
  order: TransactionDoc['order'],
  fallbackOrderId?: string,
): string | null {
  if (typeof order === 'string' || typeof order === 'number') {
    return String(order);
  }

  if (order && typeof order === 'object' && order.id != null) {
    return String(order.id);
  }

  if (fallbackOrderId) {
    return String(fallbackOrderId);
  }

  return null;
}
