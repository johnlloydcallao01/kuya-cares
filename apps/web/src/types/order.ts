/**
 * Central order domain types for apps/web.
 * Mirrors CMS `orders`, `order-items`, `transactions`, `order-tracking` collections.
 * @file src/types/order.ts
 */

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'on_delivery'
  | 'delivered'
  | 'cancelled';

export type FulfillmentType = 'delivery' | 'pickup';

export interface OrderItemOption {
  name: string;
  price: number;
}

export interface OrderItemUI {
  id: string;
  name: string;
  quantity: number;
  /** unit price in PHP */
  price: number;
  /** line total in PHP */
  totalPrice: number;
  image: string;
  options: OrderItemOption[];
  merchantName?: string;
  merchantLogo?: string | null;
  /** raw CMS ids needed for reorder */
  productId?: string | number | null;
  merchantProductId?: string | number | null;
}

export interface OrderUI {
  id: string;
  /** numeric CMS id as string */
  orderId: string;
  orderNumber: string;
  placedAt: string;
  placedAtTs: number;
  status: OrderStatus;
  fulfillmentType: FulfillmentType;
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  priorityFee?: number;
  discountTotal?: number;
  total: number;
  items: OrderItemUI[];
  restaurant: string;
  merchantId?: string | number | null;
  merchantLogo?: string | null;
  paymentMethod?: string;
  isPaid?: boolean;
}

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'accepted',
  'preparing',
  'ready_for_pickup',
  'on_delivery',
  'delivered',
  'cancelled',
];

export interface StatusMeta {
  label: string;
  shortLabel: string;
  pill: string;
  dot: string;
  icon: string;
  description: string;
  group: 'active' | 'done' | 'void';
}

export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  pending: {
    label: 'Pending',
    shortLabel: 'Pending',
    pill: 'bg-amber-100 text-amber-800 border border-amber-200',
    dot: 'bg-amber-500',
    icon: 'fas fa-clock',
    description: 'Order placed, waiting for confirmation',
    group: 'active',
  },
  accepted: {
    label: 'Accepted',
    shortLabel: 'Accepted',
    pill: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    dot: 'bg-indigo-500',
    icon: 'fas fa-clipboard-check',
    description: 'Merchant accepted your order',
    group: 'active',
  },
  preparing: {
    label: 'Preparing',
    shortLabel: 'Preparing',
    pill: 'bg-orange-100 text-orange-800 border border-orange-200',
    dot: 'bg-orange-500',
    icon: 'fas fa-utensils',
    description: 'Kitchen is preparing your food',
    group: 'active',
  },
  ready_for_pickup: {
    label: 'Ready for Pickup',
    shortLabel: 'Ready',
    pill: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    dot: 'bg-yellow-500',
    icon: 'fas fa-shopping-bag',
    description: 'Ready for pickup or rider assignment',
    group: 'active',
  },
  on_delivery: {
    label: 'On Delivery',
    shortLabel: 'On the way',
    pill: 'bg-blue-100 text-blue-800 border border-blue-200',
    dot: 'bg-blue-500',
    icon: 'fas fa-motorcycle',
    description: 'Rider is on the way',
    group: 'active',
  },
  delivered: {
    label: 'Delivered',
    shortLabel: 'Delivered',
    pill: 'bg-green-100 text-green-800 border border-green-200',
    dot: 'bg-green-600',
    icon: 'fas fa-check-circle',
    description: 'Order completed',
    group: 'done',
  },
  cancelled: {
    label: 'Cancelled',
    shortLabel: 'Cancelled',
    pill: 'bg-red-100 text-red-700 border border-red-200',
    dot: 'bg-red-500',
    icon: 'fas fa-times-circle',
    description: 'Order was cancelled',
    group: 'void',
  },
};

const warnedUnknownStatuses = new Set<string>();

export function getStatusMeta(status: string): StatusMeta {
  const known = (ORDER_STATUS_META as Record<string, StatusMeta>)[status];
  if (known) return known;
  // Unknown statuses must NOT poll forever (§12b): the old 'active' fallback
  // kept the 30s refetch loop (and amber pills) alive on data errors.
  if (!warnedUnknownStatuses.has(status)) {
    warnedUnknownStatuses.add(status);
    console.warn(`[orders] unknown status "${status}" — treating as done`);
  }
  return {
    label: String(status).replace(/_/g, ' '),
    shortLabel: String(status).replace(/_/g, ' '),
    pill: 'bg-gray-100 text-gray-700 border border-gray-200',
    dot: 'bg-gray-400',
    icon: 'fas fa-receipt',
    description: '',
    group: 'done' as const,
  };
}

/** Legacy helpers kept for backward-compat with existing imports */
export function getStatusColor(status: string): string {
  return getStatusMeta(status).pill;
}

export function getStatusIcon(status: string): string {
  return getStatusMeta(status).icon;
}

const phpFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
});

export function formatPHP(value: number | string | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return '₱0.00';
  return phpFormatter.format(n);
}

export function formatOrderDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatOrderDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function orderNumberOf(id: string | number): string {
  return `#${String(id).padStart(5, '0')}`;
}

export type SortKey = 'newest' | 'oldest' | 'highest' | 'lowest';
export type FulfillmentFilter = 'all' | FulfillmentType;
export type DateRangeFilter = 'all' | 'today' | '7d' | '30d';
