"use client";

/**
 * Real notification data layer for web — 1:1 port of
 * apps/mobile-customer/src/services/notifications.ts
 * (NotificationsScreen data + behavior).
 *
 * CMS: user-notifications (self-scoped) + notification-events via depth=2.
 * Counts split Facebook-style: unread (status) vs unseen (seenAt null).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://cms.kuyacares.com/api';
const API_KEY = process.env.NEXT_PUBLIC_PAYLOAD_API_KEY || '';

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  domain: string;
  priority: string;
  status: string;
  channel: string;
  typeKey: string;
  deliveredAt: string | null;
  metadata?: Record<string, any> | null;
  orderId?: string | null;
  seen?: boolean;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) {
    headers['Authorization'] = `users API-Key ${API_KEY}`;
  }
  return headers;
}

export async function fetchNotifications(
  userId: string | number,
  limit = 50,
): Promise<{ docs: NotificationItem[]; unreadCount: number; unseenCount: number }> {
  const res = await fetch(
    `${API_BASE}/user-notifications?where[user][equals]=${userId}&depth=2&sort=-deliveredAt&limit=${limit}`,
    { headers: buildHeaders(), cache: 'no-store', credentials: 'omit' },
  );

  if (!res.ok) throw new Error(`Request failed: ${res.status}`);

  const data = await res.json();
  const docs = Array.isArray(data?.docs) ? data.docs : [];

  const items: NotificationItem[] = docs
    .map((doc: any) => {
      const event =
        doc.notificationEvent && typeof doc.notificationEvent === 'object'
          ? doc.notificationEvent
          : null;
      if (!event) return null;

      const metadata = event.metadata || null;
      return {
        id: String(doc.id),
        title: event.title || 'Notification',
        body: event.body || '',
        domain: event.domain || 'system',
        priority: event.priority || 'info',
        status: doc.status || 'unread',
        channel: doc.channel || 'in_app',
        typeKey: event.typeKey || '',
        deliveredAt: doc.deliveredAt || doc.createdAt,
        metadata,
        orderId: metadata?.orderId ? String(metadata.orderId) : null,
        seen: Boolean(doc.seenAt),
      };
    })
    .filter(Boolean) as NotificationItem[];

  return {
    docs: items,
    unreadCount: items.filter((n) => n.status === 'unread').length,
    unseenCount: items.filter((n) => !n.seen).length,
  };
}

export async function fetchUnreadCount(userId: string | number): Promise<number> {
  const res = await fetch(
    `${API_BASE}/user-notifications?where[user][equals]=${userId}&where[status][equals]=unread&depth=0&limit=1`,
    { headers: buildHeaders(), cache: 'no-store', credentials: 'omit' },
  );
  if (!res.ok) return 0;
  const data = await res.json();
  return Number(data?.totalDocs) || 0;
}

export async function markNotificationAsRead(id: string | number): Promise<void> {
  await fetch(`${API_BASE}/user-notifications/${id}`, {
    method: 'PATCH',
    headers: buildHeaders(),
    credentials: 'omit',
    body: JSON.stringify({ status: 'read', readAt: new Date().toISOString() }),
  }).catch(() => undefined);
}

export async function markNotificationAsUnread(id: string | number): Promise<void> {
  await fetch(`${API_BASE}/user-notifications/${id}`, {
    method: 'PATCH',
    headers: buildHeaders(),
    credentials: 'omit',
    body: JSON.stringify({ status: 'unread', readAt: null }),
  }).catch(() => undefined);
}

export async function markNotificationsAsRead(ids: (string | number)[]): Promise<void> {
  await Promise.all(ids.map((id) => markNotificationAsRead(id).catch(() => undefined)));
}

export async function markAllNotificationsAsSeen(userId: string | number): Promise<void> {
  const findRes = await fetch(
    `${API_BASE}/user-notifications?where[user][equals]=${userId}&where[seenAt][exists]=false&depth=0&limit=100`,
    { headers: buildHeaders(), cache: 'no-store', credentials: 'omit' },
  ).catch(() => null);
  if (!findRes || !findRes.ok) return;
  const data = await findRes.json().catch(() => null);
  const docs = Array.isArray(data?.docs) ? data.docs : [];
  const now = new Date().toISOString();
  await Promise.all(
    docs.map((doc: any) =>
      fetch(`${API_BASE}/user-notifications/${doc.id}`, {
        method: 'PATCH',
        headers: buildHeaders(),
        credentials: 'omit',
        body: JSON.stringify({ seenAt: now }),
      }).catch(() => undefined),
    ),
  );
}

export function formatNotificationTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function getDomainStyle(domain: string): { bg: string; color: string; icon: string } {
  switch ((domain || '').toLowerCase()) {
    case 'order':
      return { bg: 'bg-indigo-100 dark:bg-indigo-950/60', color: 'text-indigo-600 dark:text-indigo-300', icon: 'fa-receipt' };
    case 'account':
      return { bg: 'bg-orange-100 dark:bg-orange-950/60', color: 'text-orange-600 dark:text-orange-300', icon: 'fa-user' };
    case 'system':
      return { bg: 'bg-violet-100 dark:bg-violet-950/60', color: 'text-violet-600 dark:text-violet-300', icon: 'fa-gear' };
    case 'marketing':
      return { bg: 'bg-amber-100 dark:bg-amber-950/60', color: 'text-amber-600 dark:text-amber-300', icon: 'fa-tag' };
    case 'custom':
      return { bg: 'bg-emerald-100 dark:bg-emerald-950/60', color: 'text-emerald-600 dark:text-emerald-300', icon: 'fa-comment' };
    default:
      return { bg: 'bg-violet-100 dark:bg-violet-950/60', color: 'text-violet-600 dark:text-violet-300', icon: 'fa-bell' };
  }
}
