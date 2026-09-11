import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig, isSupabaseRealtimeEnabled } from '../config/environment';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchNotifications as fetchNotificationsApi,
  fetchUnreadCount as fetchUnreadCountApi,
  markNotificationAsRead,
  markNotificationAsUnread,
  markNotificationsAsRead,
  markAllNotificationsAsSeen,
  type NotificationItem,
} from '../services/notifications';

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  unseenCount: number;
  isLoading: boolean;
  isRealtimeConnected: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAsUnread: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  markAllAsSeen: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

function buildItem(raw: any): NotificationItem | null {
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
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : null;

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
      const { docs, unreadCount: unread, unseenCount: unseen } = await fetchNotificationsApi(
        userId,
      );
      setNotifications(docs);
      setUnreadCount(unread);
      setUnseenCount(unseen);
    } catch (err) {
      console.error('[NotificationsContext] Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const syncUnreadOnly = useCallback(async () => {
    if (!userId) return;
    try {
      const count = await fetchUnreadCountApi(userId);
      setUnreadCount(count);
    } catch {
      // Best-effort - a later poll or realtime event will correct it.
    }
  }, [userId]);

  // Initial load + reload whenever the logged-in user changes.
  useEffect(() => {
    loadAll();
  }, [userId, loadAll]);

  // Periodic + foreground re-sync (Realtime broadcast is ephemeral).
  useEffect(() => {
    const interval = setInterval(() => {
      loadAll();
    }, 45000);

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        loadAll();
      }
    });

    return () => {
      clearInterval(interval);
      appStateSub.remove();
    };
  }, [loadAll]);

  // Supabase Realtime subscription for instant bell updates.
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
        .on(
          'broadcast',
          { event: 'new_notification' },
          (payload: any) => {
            const item = buildItem(payload?.payload?.notification);
            if (item) {
              setNotifications((prev) => [
                item,
                ...prev.filter((n) => n.id !== item.id),
              ]);
              if (!item.seen) {
                setUnseenCount((prev) => prev + 1);
              }
              if (item.status !== 'read') {
                setUnreadCount((prev) => prev + 1);
              }
            }
          },
        )
        .on(
          'broadcast',
          { event: 'notification_read' },
          ({ payload }: any) => {
            const id = payload?.notificationId;
            if (!id) return;
            setNotifications((prev) =>
              prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n)),
            );
            setUnreadCount((prev) => Math.max(0, prev - 1));
          },
        )
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
    async (id: string) => {
      const target = notifications.find((n) => n.id === id);
      const wasUnread = target?.status !== 'read';
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n)),
      );
      if (wasUnread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
      try {
        await markNotificationAsRead(id);
      } catch (err) {
        console.error('[NotificationsContext] markAsRead failed:', err);
      }
      syncUnreadOnly();
    },
    [notifications, syncUnreadOnly],
  );

  const markAllAsRead = useCallback(async () => {
    const unread = notifications.filter((n) => n.status === 'unread');
    if (unread.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read' })));
    setUnreadCount(0);
    await markNotificationsAsRead(unread.map((n) => n.id));
  }, [notifications]);

  const markAsUnread = useCallback(async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    const wasRead = target?.status === 'read';
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: 'unread' } : n)),
    );
    if (wasRead) {
      setUnreadCount((prev) => prev + 1);
    }
    try {
      await markNotificationAsUnread(id);
    } catch (err) {
      console.error('[NotificationsContext] markAsUnread failed:', err);
    }
    syncUnreadOnly();
  }, [notifications, syncUnreadOnly]);

  // Clears the bell badge but keeps notifications unread - Facebook-style.
  const markAllAsSeen = useCallback(async () => {
    if (unseenCount === 0) return;
    if (!userId) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, seen: true })));
    setUnseenCount(0);
    try {
      await markAllNotificationsAsSeen(userId);
    } catch (err) {
      console.error('[NotificationsContext] markAllAsSeen failed:', err);
    }
  }, [unseenCount, userId]);

  const value: NotificationsContextValue = {
    notifications,
    unreadCount,
    unseenCount,
    isLoading,
    isRealtimeConnected,
    fetchNotifications: loadAll,
    markAsRead,
    markAsUnread,
    markAllAsRead,
    markAllAsSeen,
  };

  return (
    <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}