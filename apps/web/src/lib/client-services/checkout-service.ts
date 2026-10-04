"use client";

/**
 * Shared checkout service for apps/web — a direct port of
 * apps/mobile-customer/src/services/checkoutReturn.ts plus the order-creation
 * pipeline from CheckoutScreen, adapted from AsyncStorage to localStorage.
 *
 * Single-merchant checkout, mirrored step-for-step:
 *  delivery quote → order + delivery-location + order-items + cart link →
 *  pending transaction → PayMongo attach → return finalize (accept + ordered
 *  + Lalamove book with rollback) + pending-session recovery.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';

function cmsHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const apiKey = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY;
  if (apiKey) headers['Authorization'] = `users API-Key ${apiKey}`;
  return headers;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const PAYMONGO_MINIMUM_AMOUNT_PHP = 1;

/** Freshness window for a pending session started on this device (mobile parity: 15min). */
export const PENDING_SESSION_TTL_MS = 15 * 60 * 1000;

export type PendingCheckoutSession = {
  customerId: string;
  merchantId: string;
  orderId: string;
  paymentIntentId: string;
  createdAt: string;
};

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
  `kuyacares:pending-checkout:${customerId}:${merchantId}`;

function storage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    /* private mode etc. */
  }
  return null;
}

export function isPendingSessionFresh(createdAt: string): boolean {
  const ts = new Date(createdAt).getTime();
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= PENDING_SESSION_TTL_MS;
}

// ---------- delivery quote (Lalamove, checkout-only like mobile) ----------

export type DeliveryQuote =
  | { available: false }
  | { available: true; deliveryFee: number; priorityFee: number; distanceMeters: number | null };

export async function fetchDeliveryQuote(args: {
  merchantId: number | string;
  customerId: number | string;
}): Promise<DeliveryQuote> {
  const res = await fetch(`${API_BASE}/delivery/quote`, {
    method: 'POST',
    headers: cmsHeaders(),
    body: JSON.stringify({
      merchantId: Number(args.merchantId),
      customerId: Number(args.customerId),
    }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Could not get delivery quote');
  if (data?.data?.available === false) return { available: false };
  const distance = data?.data?.distance as { value?: string | number; unit?: string } | null;
  let distanceMeters: number | null = null;
  if (distance && distance.value != null) {
    const raw = Number(distance.value);
    if (Number.isFinite(raw)) {
      const unit = String(distance.unit || 'm').toLowerCase();
      distanceMeters = unit === 'km' ? raw * 1000 : raw;
    }
  }
  return {
    available: true,
    deliveryFee: Number(data?.data?.deliveryFee) || 0,
    priorityFee: Number(data?.data?.priorityFee) || 0,
    distanceMeters,
  };
}

// ---------- order creation pipeline (mobile CheckoutScreen parity) ----------

export type CheckoutCartItem = {
  id: number | string;
  product: number | string | { id?: number | string } | null;
  merchantProduct: number | string | { id?: number | string } | null;
  productName?: string;
  priceAtAdd: number;
  quantity: number;
  subtotal: number;
  selectedVariation?: number | string | null;
  selectedVariationName?: string | null;
  selectedModifiers?: any[] | null;
};

function normalizeLabel(label: string): string {
  const v = String(label || '').trim().toLowerCase();
  if (v === 'home') return 'home';
  if (v === 'work' || v === 'office') return 'office';
  return 'other';
}

function toId(v: unknown): string | number | null {
  if (v == null) return null;
  if (typeof v === 'string' || typeof v === 'number') return v;
  if (typeof v === 'object' && v !== null && 'id' in v) {
    const id = (v as { id: unknown }).id;
    if (typeof id === 'string' || typeof id === 'number') return id;
  }
  return null;
}

export async function createPendingOrder(args: {
  customerId: string | number;
  merchantId: number | string;
  activeAddressId: string | number;
  items: CheckoutCartItem[];
  subtotal: number;
  deliveryFee: number;
  orderTotal: number;
  customerName: string;
  customerPhone?: string | null;
}): Promise<{ orderId: string }> {
  const headers = cmsHeaders();
  const merchantIdNum = Number(args.merchantId);

  const orderRes = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      customer: Number(args.customerId),
      merchant: merchantIdNum,
      status: 'pending',
      fulfillment_type: 'delivery',
      total: args.orderTotal,
      subtotal: args.subtotal,
      delivery_fee: args.deliveryFee,
      platform_fee: 0,
      placed_at: new Date().toISOString(),
    }),
  });
  const orderData = await orderRes.json().catch(() => ({}));
  if (!orderRes.ok || !orderData?.doc?.id) throw new Error('Failed to create pending order');
  const createdOrderId = orderData.doc.id;

  // Address snapshot for the delivery record (customer + merchant sides).
  try {
    const addrRes = await fetch(`${API_BASE}/addresses/${args.activeAddressId}`, { headers });
    if (addrRes.ok) {
      const addrData = await addrRes.json();
      const addressText =
        addrData.formatted_address ||
        [addrData.street_number, addrData.route, addrData.barangay, addrData.locality, addrData.country]
          .filter(Boolean)
          .join(', ');

      let merchantAddrData: any = {};
      try {
        const merchantRes = await fetch(`${API_BASE}/merchants/${merchantIdNum}?depth=1`, { headers });
        if (merchantRes.ok) {
          const merchantData = await merchantRes.json();
          const merchantAddrId =
            typeof merchantData?.activeAddress === 'object'
              ? merchantData.activeAddress?.id
              : merchantData?.activeAddress;
          if (merchantAddrId) {
            const mAddrRes = await fetch(`${API_BASE}/addresses/${merchantAddrId}`, { headers });
            if (mAddrRes.ok) merchantAddrData = await mAddrRes.json();
          }
        }
      } catch {
        /* non-critical */
      }

      await fetch(`${API_BASE}/delivery-locations`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          order: createdOrderId,
          formatted_address: addressText || 'Unknown Address',
          coordinates: {
            lat: addrData.latitude || 0,
            lng: addrData.longitude || 0,
          },
          street: addrData.street || null,
          floor_unit_room: addrData.floor_unit_room || null,
          delivery_instructions: addrData.delivery_instructions || null,
          notes: addrData.notes || addrData.accessibility_notes || null,
          contact_name: args.customerName || 'Customer',
          contact_phone: args.customerPhone || null,
          label: normalizeLabel(addrData.label || addrData.address_type || ''),
          merchant_formatted_address: merchantAddrData.formatted_address || null,
          merchant_coordinates:
            merchantAddrData.latitude && merchantAddrData.longitude
              ? { lat: merchantAddrData.latitude, lng: merchantAddrData.longitude }
              : null,
          merchant_street: merchantAddrData.street || null,
          merchant_floor_unit_room: merchantAddrData.floor_unit_room || null,
          merchant_delivery_instructions: merchantAddrData.delivery_instructions || null,
          merchant_label: normalizeLabel(merchantAddrData.label || merchantAddrData.address_type || ''),
        }),
      });
    }
  } catch {
    /* address snapshot is best-effort; the order itself stands */
  }

  // Order items + cart linkage (sequential like mobile — item order kept).
  for (const item of args.items) {
    const optionsSnapshot = [
      ...(item.selectedVariation
        ? [
            {
              entryType: 'variation',
              name: item.selectedVariationName || `Variation #${item.selectedVariation}`,
              selectedVariationId: item.selectedVariation,
              selectedVariationName: item.selectedVariationName || undefined,
              price: 0,
            },
          ]
        : []),
      ...((item.selectedModifiers || []).map((modifier: any) => ({
        entryType: 'modifier',
        sourceType: modifier?.source,
        groupId: modifier?.groupId,
        groupName: modifier?.groupName,
        optionId: modifier?.optionId,
        optionName: modifier?.name,
        selectedVariationId: item.selectedVariation || undefined,
        selectedVariationName: item.selectedVariationName || undefined,
        name: modifier?.name || 'Modifier',
        price: typeof modifier?.price === 'number' ? modifier.price : 0,
      }))),
    ];

    await fetch(`${API_BASE}/order-items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        order: createdOrderId,
        product: toId(item.product),
        merchant_product: toId(item.merchantProduct),
        product_name_snapshot: item.productName || 'Item',
        price_at_purchase: item.priceAtAdd,
        quantity: item.quantity,
        options_snapshot: optionsSnapshot,
        total_price: item.subtotal,
      }),
    });

    await fetch(`${API_BASE}/cart-items/${item.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ order_id: createdOrderId }),
    }).catch(() => undefined);
  }

  return { orderId: String(createdOrderId) };
}

export async function createPendingTransaction(args: {
  orderId: string | number;
  paymentIntentId: string;
  paymentMethod: string;
  amount: number;
}): Promise<{ transactionId?: string | number }> {
  const res = await fetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: cmsHeaders(),
    body: JSON.stringify({
      order: args.orderId,
      payment_intent_id: args.paymentIntentId,
      payment_method: args.paymentMethod,
      amount: args.amount,
      currency: 'PHP',
      status: 'pending',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || 'Failed to record transaction');
  return { transactionId: data?.doc?.id };
}

// ---------- pending session (recovery across refresh/close) ----------

export async function savePendingCheckoutSession(session: PendingCheckoutSession): Promise<void> {
  storage()?.setItem(pendingCheckoutKey(session.customerId, session.merchantId), JSON.stringify(session));
}

export async function getPendingCheckoutSession(
  customerId: string,
  merchantId: string,
): Promise<PendingCheckoutSession | null> {
  const raw = storage()?.getItem(pendingCheckoutKey(customerId, merchantId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingCheckoutSession;
  } catch {
    storage()?.removeItem(pendingCheckoutKey(customerId, merchantId));
    return null;
  }
}

export async function clearPendingCheckoutSession(customerId: string, merchantId: string): Promise<void> {
  storage()?.removeItem(pendingCheckoutKey(customerId, merchantId));
}

export async function findActiveCartLinkedOrder(
  customerId: string,
  merchantId: string,
): Promise<string | null> {
  const res = await fetch(
    `${API_BASE}/cart-items?where[customer][equals]=${customerId}&where[merchant][equals]=${merchantId}&where[status][equals]=active&limit=200&depth=0`,
    { headers: cmsHeaders() },
  );
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  const docs = Array.isArray(data?.docs) ? data.docs : [];
  for (const doc of docs) {
    const orderId = resolveOrderId(doc?.order_id);
    if (orderId) return orderId;
  }
  return null;
}

// ---------- payment status + finalize (mobile checkoutReturn parity) ----------

export async function waitForPaidTransaction(
  paymentIntentId: string,
  fallbackOrderId?: string,
  attempts = 20,
  intervalMs = 1500,
): Promise<{ transaction: TransactionDoc; orderId: string }> {
  const headers = cmsHeaders();
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(
      `${API_BASE}/transactions?where[payment_intent_id][equals]=${paymentIntentId}&depth=1&limit=1`,
      { headers },
    );
    if (response.ok) {
      const data = await response.json().catch(() => ({}));
      const transaction = Array.isArray(data?.docs) ? data.docs[0] : null;
      if (transaction) {
        const status = String(transaction.status || '').toLowerCase();
        const resolvedOrderId = resolveOrderId(transaction.order, fallbackOrderId);
        if (status === 'paid' && resolvedOrderId) {
          return { transaction, orderId: resolvedOrderId };
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
  const headers = cmsHeaders();
  const orderedAt = paidAt || new Date().toISOString();

  await fetch(`${API_BASE}/orders/${orderId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'accepted' }),
  }).catch(() => undefined);

  const cartItemsResponse = await fetch(
    `${API_BASE}/cart-items?where[order_id][equals]=${orderId}&limit=200&depth=0`,
    { headers },
  );
  if (cartItemsResponse.ok) {
    const cartItemsData = await cartItemsResponse.json().catch(() => ({}));
    const cartItems = Array.isArray(cartItemsData?.docs) ? cartItemsData.docs : [];
    await Promise.all(
      cartItems.map((item: any) =>
        fetch(`${API_BASE}/cart-items/${item.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ status: 'ordered', ordered_at: orderedAt }),
        }).catch(() => undefined),
      ),
    );
  }

  // Book the Lalamove delivery now that payment is confirmed.
  try {
    await bookLalamoveDelivery(orderId);
  } catch {
    // Roll back order status — admin must re-trigger delivery booking.
    await fetch(`${API_BASE}/orders/${orderId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'pending' }),
    }).catch(() => undefined);
  }
}

/** Books Lalamove delivery. Retries 3x with backoff; 409 (already booked) is success. */
export async function bookLalamoveDelivery(
  orderId: string,
  retries = 3,
  delayMs = 1000,
): Promise<{ deliveryBookingId: number; lalamoveOrderId: string; shareLink: string; deliveryFee: number; status: string }> {
  const headers = cmsHeaders();
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const response = await fetch(`${API_BASE}/delivery/book`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ orderId: Number(orderId) }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) return data?.data;
    const message = data?.error || `Failed to book delivery (${response.status})`;
    if (attempt < retries) {
      await sleep(delayMs);
      delayMs *= 2;
      continue;
    }
    throw new Error(message);
  }
  throw new Error('Failed to book delivery after all retries');
}

export async function getCheckoutPaymentStatus(args: {
  paymentIntentId?: string;
  orderId?: string;
}): Promise<CheckoutPaymentStatus> {
  const headers = cmsHeaders();

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
    return { status: 'paid', orderId: resolvedOrderId, paymentIntentId: paymentIntentId || undefined, transaction: transaction || undefined, paidAt: transaction?.paid_at || null };
  }
  if (transactionStatus === 'failed') {
    return { status: 'failed', orderId: resolvedOrderId || undefined, paymentIntentId: paymentIntentId || undefined };
  }
  if (resolvedOrderId) {
    const order = await fetchOrderById(resolvedOrderId, headers);
    const orderStatus = String(order?.status || '').toLowerCase();
    if (isPaidOrderStatus(orderStatus)) {
      return { status: 'paid', orderId: resolvedOrderId, paymentIntentId: paymentIntentId || undefined, transaction: transaction || undefined, paidAt: transaction?.paid_at || null };
    }
    if (orderStatus === 'cancelled') {
      return { status: 'failed', orderId: resolvedOrderId, paymentIntentId: paymentIntentId || undefined };
    }
  }
  if (transactionStatus === 'pending' || resolvedOrderId || paymentIntentId) {
    return { status: 'pending', orderId: resolvedOrderId || undefined, paymentIntentId: paymentIntentId || undefined };
  }
  return { status: 'none' };
}

async function fetchTransactionByPaymentIntent(
  paymentIntentId: string,
  headers: Record<string, string>,
): Promise<TransactionDoc | null> {
  const response = await fetch(
    `${API_BASE}/transactions?where[payment_intent_id][equals]=${paymentIntentId}&depth=1&limit=1`,
    { headers },
  );
  if (!response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data?.docs) ? data.docs[0] || null : null;
}

async function fetchTransactionByOrderId(
  orderId: string,
  headers: Record<string, string>,
): Promise<TransactionDoc | null> {
  const response = await fetch(
    `${API_BASE}/transactions?where[order][equals]=${orderId}&depth=1&limit=1&sort=-createdAt`,
    { headers },
  );
  if (!response.ok) return null;
  const data = await response.json().catch(() => ({}));
  return Array.isArray(data?.docs) ? data.docs[0] || null : null;
}

async function fetchOrderById(
  orderId: string,
  headers: Record<string, string>,
): Promise<OrderDoc | null> {
  const response = await fetch(`${API_BASE}/orders/${orderId}`, { headers });
  if (!response.ok) return null;
  return (await response.json().catch(() => null)) as OrderDoc | null;
}

function isPaidOrderStatus(status: string): boolean {
  return ['accepted', 'preparing', 'ready_for_pickup', 'on_delivery', 'delivered'].includes(status);
}

function resolveOrderId(
  order: TransactionDoc['order'],
  fallbackOrderId?: string,
): string | null {
  if (typeof order === 'string' || typeof order === 'number') return String(order);
  if (order && typeof order === 'object' && order.id != null) return String(order.id);
  if (fallbackOrderId) return String(fallbackOrderId);
  return null;
}
