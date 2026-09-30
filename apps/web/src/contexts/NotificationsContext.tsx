'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { useUser } from '@/hooks/useAuth';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsAsSeen,
  markNotificationAsRead,
  markNotificationAsUnread,
  markNotificationsAsRead,
  type NotificationItem,
} from '@/lib/client-services/notification-service';

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  unseenCount: number;
  isLoading: boolean;
  isRealtimeConnected: boolean;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => void;
  markAsUnread: (id: string) => void;
  markAllAsRead: () => void;
  markAllAsSeen: () => void;
  toggleRead: (id: string) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

// Same Supabase project as CMS/mobile — public anon key only.
const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
};

function isSupabaseRealtimeEnabled(): boolean {
  return Boolean(supabaseConfig.url && supabaseConfig.anonKey);
}

function buildRealtimeItem(raw: any): NotificationItem | null {
  if (!raw) return null;
  const metadata = raw.metadata || null;
  return {
    id: String(raw.id ?? ''),
    title: raw.title || 'Notification',
    body: raw.body || '',
    domain: raw.domain || 'system',
    priority: raw.priority || 'info',
    status: raw.status || 'unread',
    channel: raw.channel || 'in_app',
    typeKey: raw.typeKey || '',
    deliveredAt: raw.deliveredAt || new Date().toISOString(),
    metadata,
    orderId: metadata?.orderId ? String(metadata.orderId) : null,
    seen: Boolean(raw.seenAt),
  };
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const userId = user?.id ?? null;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unseenCount, setUnseenCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const channelRef = useRef<any>(null);

  const loadAll = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setUnseenCount(0);
      return;
    }
    setIsLoading(true);
    try {
      const data = await fetchNotifications(userId, 50);
      setNotifications(data.docs);
      setUnreadCount(data.unreadCount);
      setUnseenCount(data.unseenCount);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const syncUnreadOnly = useCallback(async () => {
    if (!userId) return;
    try {
      const count = await fetchUnreadCount(userId);
      setUnreadCount(count);
    } catch {
      /* keep stale count */
    }
  }, [userId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Poll every 45s + refetch when tab becomes visible (mobile: 45s + AppState active).
  // Kept as fallback — Realtime broadcast below is ephemeral.
  useEffect(() => {
    if (!userId) return;
    const timer = setInterval(loadAll, 45000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadAll();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', loadAll);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', loadAll);
    };
  }, [userId, loadAll]);

  // Supabase Realtime subscription for instant bell updates — mirrors mobile
  // NotificationsContext on the same channel/event: notifications:user:{id} /
  // new_notification (+ notification_read). Broadcast is ephemeral; 45s poll
  // above remains the fallback.
  useEffect(() => {
    if (!userId) return;
    if (!isSupabaseRealtimeEnabled()) return;

    let supabase: SupabaseClient | null = null;
    let channel: any = null;

    try {
      supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      supabaseRef.current = supabase;

      const channelName = `notifications:user:${userId}`;
      channel = supabase
        .channel(channelName, { config: { broadcast: { self: true } } })
        .on('broadcast', { event: 'new_notification' }, (payload: any) => {
          const item = buildRealtimeItem(payload?.payload?.notification);
          if (item) {
            setNotifications((prev) => [item, ...prev.filter((n) => n.id !== item.id)]);
            if (!item.seen) {
              setUnseenCount((prev) => prev + 1);
            }
            if (item.status !== 'read') {
              setUnreadCount((prev) => prev + 1);
            }
          }
        })
        .on('broadcast', { event: 'notification_read' }, ({ payload }: any) => {
          const id = payload?.notificationId;
          if (!id) return;
          setNotifications((prev) =>
            prev.map((n) => (String(n.id) === String(id) ? { ...n, status: 'read' } : n)),
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        })
        .subscribe((status: string, err?: any) => {
          setIsRealtimeConnected(status === 'SUBSCRIBED');
          if (err) {
            console.warn('[NotificationsContext] Realtime subscribe error:', err?.message);
          }
        });

      channelRef.current = channel;
    } catch (err) {
      console.warn('[NotificationsContext] Realtime init failed:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase?.removeChannel(channel);
        } catch {
          // cleanup best-effort
        }
      }
      supabaseRef.current = null;
      channelRef.current = null;
      setIsRealtimeConnected(false);
    };
  }, [userId]);

  const markAsRead = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
      markNotificationAsRead(id).then(() => syncUnreadOnly());
    },
    [syncUnreadOnly],
  );

  const markAsUnread = useCallback(
    (id: string) => {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, status: 'unread' } : n)));
      setUnreadCount((c) => c + 1);
      markNotificationAsUnread(id).then(() => syncUnreadOnly());
    },
    [syncUnreadOnly],
  );

  const toggleRead = useCallback(
    (id: string) => {
      const current = notifications.find((n) => n.id === id);
      if (!current) return;
      if (current.status === 'unread') markAsRead(id);
      else markAsUnread(id);
    },
    [notifications, markAsRead, markAsUnread],
  );

  const markAllAsRead = useCallback(() => {
    const ids = notifications.filter((n) => n.status === 'unread').map((n) => n.id);
    if (ids.length === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read' })));
    setUnreadCount(0);
    markNotificationsAsRead(ids);
  }, [notifications]);

  const markAllAsSeen = useCallback(() => {
    if (!userId) return;
    setUnseenCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, seen: true })));
    markAllNotificationsAsSeen(userId);
  }, [userId]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      unseenCount,
      isLoading,
      isRealtimeConnected,
      refresh: loadAll,
      markAsRead,
      markAsUnread,
      markAllAsRead,
      markAllAsSeen,
      toggleRead,
    }),
    [
      notifications,
      unreadCount,
      unseenCount,
      isLoading,
      isRealtimeConnected,
      loadAll,
      markAsRead,
      markAsUnread,
      markAllAsRead,
      markAllAsSeen,
      toggleRead,
    ],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider');
  return ctx;
}
