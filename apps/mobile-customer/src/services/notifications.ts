import { apiConfig } from '../config/environment';

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
  if (apiConfig.payloadApiKey) {
    headers['Authorization'] = `users API-Key ${apiConfig.payloadApiKey}`;
  }
  return headers;
}

/**
 * Fetch the user's in-app notifications (with their notification event
 * expanded via depth=2). Counts are split Facebook-style:
 * - unreadCount  = items whose status is still "unread" (per-item read state)
 * - unseenCount  = items the user has never opened (seenAt is null) - this
 *   drives the bell badge and is cleared when the bell is clicked, without
 *   marking items as read.
 */
export async function fetchNotifications(
  userId: string | number,
  limit = 50,
): Promise<{ docs: NotificationItem[]; unreadCount: number; unseenCount: number }> {
  const headers = buildHeaders();
  const res = await fetch(
    `${apiConfig.baseUrl}/user-notifications?where[user][equals]=${userId}&depth=2&sort=-deliveredAt&limit=${limit}`,
    { headers, cache: 'no-store' },
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

/**
 * Fetch just the unread total (lightweight, used for refresh).
 */
export async function fetchUnreadCount(userId: string | number): Promise<number> {
  const headers = buildHeaders();
  const res = await fetch(
    `${apiConfig.baseUrl}/user-notifications?where[user][equals]=${userId}&where[status][equals]=unread&depth=0&limit=1`,
    { headers, cache: 'no-store' },
  );
  if (!res.ok) return 0;
  const data = await res.json();
  return Number(data?.totalDocs) || 0;
}

export async function markNotificationAsRead(id: string | number): Promise<void> {
  const headers = buildHeaders();
  await fetch(`${apiConfig.baseUrl}/user-notifications/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'read', readAt: new Date().toISOString() }),
  });
}

export async function markNotificationAsUnread(id: string | number): Promise<void> {
  const headers = buildHeaders();
  await fetch(`${apiConfig.baseUrl}/user-notifications/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ status: 'unread', readAt: null }),
  });
}

export async function markNotificationsAsRead(ids: (string | number)[]): Promise<void> {
  await Promise.all(ids.map((id) => markNotificationAsRead(id).catch(() => undefined)));
}

/**
 * Mark a single notification as seen (visited) WITHOUT marking it read.
 */
export async function markNotificationAsSeen(id: string | number): Promise<void> {
  const headers = buildHeaders();
  await fetch(`${apiConfig.baseUrl}/user-notifications/${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ seenAt: new Date().toISOString() }),
  });
}

/**
 * Mark all the user's unseen notifications as seen (bell click). Clears the
 * badge count but leaves every item unread - read/unread stays explicit.
 * Mirror of the "mark all as seen" flow with seen_at on the server.
 */
export async function markAllNotificationsAsSeen(userId: string | number): Promise<void> {
  const headers = buildHeaders();
  // Find every notification the user has never opened.
  const findRes = await fetch(
    `${apiConfig.baseUrl}/user-notifications?where[user][equals]=${userId}&where[seenAt][exists]=false&depth=0&limit=100`,
    { headers, cache: 'no-store' },
  );
  if (!findRes.ok) return;
  const data = await findRes.json();
  const docs = Array.isArray(data?.docs) ? data.docs : [];
  const now = new Date().toISOString();
  await Promise.all(
    docs.map((doc: any) =>
      fetch(`${apiConfig.baseUrl}/user-notifications/${doc.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ seenAt: now }),
      }).catch(() => undefined),
    ),
  );
}