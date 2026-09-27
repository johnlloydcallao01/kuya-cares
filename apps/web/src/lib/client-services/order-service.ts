"use client";

import {
  formatOrderDate,
  orderNumberOf,
  type FulfillmentType,
  type OrderStatus,
  type OrderUI,
} from '@/types/order';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';
const API_KEY = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || '';

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) h['Authorization'] = `users API-Key ${API_KEY}`;
  return h;
}

function resolveImageUrl(url: string | null | undefined): string {
  if (!url) return 'https://placehold.co/400';
  if (url.startsWith('http')) return url;
  const base = API_URL.replace('/api', '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

function merchantNameOf(merchant: any): string {
  if (!merchant || typeof merchant !== 'object') return 'Unknown Restaurant';
  if (merchant.outletName?.trim()) return merchant.outletName;
  if (merchant.name?.trim()) return merchant.name;
  if (merchant.vendor?.businessName?.trim()) return merchant.vendor.businessName;
  return 'Unknown Restaurant';
}

function merchantLogoOf(merchant: any): string | null {
  try {
    const logo = merchant?.vendor?.logo;
    if (logo && typeof logo === 'object') {
      return logo.cloudinaryURL || logo.url || logo.thumbnailURL || null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function itemImageOf(product: any): string {
  let raw: string | null = null;
  if (product && typeof product === 'object') {
    const primary = product.media?.primaryImage;
    if (primary && typeof primary === 'object') {
      raw = primary.cloudinaryURL || primary.url || primary.thumbnailURL || null;
    }
    if (!raw && product.image) {
      if (typeof product.image === 'object') {
        raw = product.image.cloudinaryURL || product.image.url || null;
      } else if (typeof product.image === 'string') {
        raw = product.image;
      }
    }
  }
  return resolveImageUrl(raw);
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

export interface FetchOrdersOptions {
  limit?: number;
  page?: number;
}

export interface FetchOrdersResult {
  orders: OrderUI[];
  totalDocs: number;
  totalPages: number;
  page: number;
}

/**
 * Enterprise order listing fetch.
 * 1) GET /orders filtered by customer.user
 * 2) GET /order-items for those orders
 * 3) GET /transactions for paid flags
 */
export async function fetchCustomerOrders(
  userId: string | number,
  opts: FetchOrdersOptions = {},
): Promise<FetchOrdersResult> {
  const limit = opts.limit ?? 50;
  const page = opts.page ?? 1;
  const h = headers();

  const orderParams = new URLSearchParams({
    'where[customer.user][equals]': String(userId),
    depth: '3',
    sort: '-placed_at',
    limit: String(limit),
    page: String(page),
  });
  const ordersRes = await fetch(`${API_URL}/orders?${orderParams.toString()}`, {
    headers: h,
    cache: 'no-store',
  });
  if (!ordersRes.ok) throw new Error(`Failed to load orders (${ordersRes.status})`);
  const ordersData = await ordersRes.json();
  const docs: any[] = Array.isArray(ordersData?.docs) ? ordersData.docs : [];

  if (docs.length === 0) {
    return {
      orders: [],
      totalDocs: ordersData?.totalDocs ?? 0,
      totalPages: ordersData?.totalPages ?? 1,
      page: ordersData?.page ?? 1,
    };
  }

  const orderIds = docs.map((d) => d.id);
  const [itemsData, txData] = await Promise.all([
    fetch(
      `${API_URL}/order-items?${new URLSearchParams({
        'where[order][in]': orderIds.join(','),
        depth: '2',
        limit: '500',
      }).toString()}`,
      { headers: h, cache: 'no-store' },
    )
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .catch(() => ({ docs: [] })),
    fetch(
      `${API_URL}/transactions?${new URLSearchParams({
        'where[order][in]': orderIds.join(','),
        depth: '0',
        limit: String(orderIds.length),
      }).toString()}`,
      { headers: h, cache: 'no-store' },
    )
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .catch(() => ({ docs: [] })),
  ]);

  const allItems: any[] = Array.isArray(itemsData?.docs) ? itemsData.docs : [];
  const txByOrder = new Map<string, any>();
  for (const tx of (txData?.docs ?? []) as any[]) {
    const oid = String(toId(tx.order) ?? '');
    if (oid && !txByOrder.has(oid)) txByOrder.set(oid, tx);
  }

  const orders: OrderUI[] = docs.map((order: any) => {
    const merchant = order.merchant;
    const restaurant = merchantNameOf(merchant);
    const merchantLogo = merchantLogoOf(merchant);
    const orderItems = allItems.filter(
      (it: any) => String(toId(it.order) ?? '') === String(order.id),
    );
    const tx = txByOrder.get(String(order.id));

    return {
      id: `ORD-${order.id}`,
      orderId: String(order.id),
      orderNumber: orderNumberOf(order.id),
      placedAt: order.placed_at ? formatOrderDate(order.placed_at) : '',
      placedAtTs: order.placed_at ? new Date(order.placed_at).getTime() : 0,
      status: (order.status ?? 'pending') as OrderStatus,
      fulfillmentType: (order.fulfillment_type === 'pickup' ? 'pickup' : 'delivery') as FulfillmentType,
      subtotal: Number(order.subtotal ?? 0),
      deliveryFee: Number(order.delivery_fee ?? 0),
      platformFee: Number(order.platform_fee ?? 0),
      priorityFee: Number(order.priority_fee ?? 0),
      discountTotal: Number(order.discount_total ?? 0),
      total: Number(order.total ?? 0),
      restaurant,
      merchantId: toId(merchant),
      merchantLogo,
      paymentMethod: tx?.payment_method || undefined,
      isPaid: tx?.status === 'paid',
      items: orderItems.map((item: any) => {
        const product = item.product;
        const mp = item.merchant_product;
        let itemMerchantName = restaurant;
        if (mp && typeof mp === 'object' && mp.merchant_id && typeof mp.merchant_id === 'object') {
          itemMerchantName =
            mp.merchant_id.outletName || mp.merchant_id.name || restaurant;
        }
        return {
          id: String(item.id),
          name: item.product_name_snapshot || product?.name || 'Item',
          quantity: Number(item.quantity ?? 1),
          price: Number(item.price_at_purchase ?? 0),
          totalPrice: Number(item.total_price ?? item.price_at_purchase ?? 0),
          image: itemImageOf(product),
          options: Array.isArray(item.options_snapshot)
            ? item.options_snapshot.map((o: any) => ({
                name: o.optionName || o.name || 'Option',
                price: Number(o.price ?? 0),
              }))
            : [],
          merchantName: itemMerchantName,
          merchantLogo,
          productId: toId(product) ?? toId(item.product),
          merchantProductId: toId(mp) ?? toId(item.merchant_product),
        };
      }),
    };
  });

  return {
    orders,
    totalDocs: ordersData?.totalDocs ?? orders.length,
    totalPages: ordersData?.totalPages ?? 1,
    page: ordersData?.page ?? page,
  };
}

export async function resolveCustomerId(userId: string | number): Promise<string | number | null> {
  try {
    const res = await fetch(
      `${API_URL}/customers?${new URLSearchParams({
        'where[user][equals]': String(userId),
        limit: '1',
        depth: '0',
      }).toString()}`,
      { headers: headers(), cache: 'no-store' },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.docs?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

/** Cancel is best-effort: Lalamove cancel first, then mark order cancelled. */
export async function cancelOrder(orderId: string | number): Promise<void> {
  const h = headers();
  try {
    await fetch(`${API_URL}/delivery/cancel`, {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ orderId: String(orderId) }),
    });
  } catch {
    /* delivery cancel is optional — order cancel still proceeds */
  }
  const res = await fetch(`${API_URL}/orders/${orderId}`, {
    method: 'PATCH',
    headers: h,
    body: JSON.stringify({ status: 'cancelled' }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Cancel failed (${res.status})`);
  }
}

export async function submitOrderReview(input: {
  orderId: string | number;
  customerId: string | number;
  merchantId: string | number;
  rating: number;
  comment?: string;
}): Promise<void> {
  const res = await fetch(`${API_URL}/reviews`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      order: Number(input.orderId),
      customer: Number(input.customerId),
      merchant: Number(input.merchantId),
      merchant_rating: input.rating,
      comment: input.comment || '',
      is_public: false,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Review failed (${res.status})`);
  }
}

export function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error('Clipboard unavailable'));
}
