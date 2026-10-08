'use client';

import React from 'react';
import { NotificationList } from '@/components/notifications/NotificationList';
import { useNotifications } from '@/contexts/NotificationsContext';

/**
 * Real notifications page — full parity with mobile NotificationsScreen.
 * No filter tabs, no delete, no mock data. Tap order → /orders/:id.
 * Desktop modal (NotificationPopup) renders this same shared content.
 */
export default function NotificationsPage() {
  const {
    notifications,
    unreadCount,
    isLoading,
    refresh,
    markAllAsRead,
    toggleRead,
  } = useNotifications();

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Header — same as mobile: title + Mark all read pill */}
      <div className="bg-white dark:bg-[#111111] border-b border-gray-200 dark:border-[#262626]">
        <div className="px-4 pt-8 pb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Notifications</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                aria-label="Refresh notifications"
                className="w-9 h-9 rounded-full bg-gray-100 dark:bg-[#1c1c1c] flex items-center justify-center hover:bg-gray-200 dark:hover:bg-[#303030] transition-colors disabled:opacity-50"
              >
                <i
                  className={`fa fa-refresh text-gray-600 dark:text-gray-300 text-sm ${
                    refreshing ? 'animate-spin' : ''
                  }`}
                />
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="px-3 py-1.5 bg-[#239459] text-white rounded-full text-xs font-semibold hover:bg-[#1c7a4a] transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <NotificationList
        notifications={notifications}
        unreadCount={unreadCount}
        isLoading={isLoading}
        refreshing={refreshing}
        onMarkAllAsRead={markAllAsRead}
        onToggleRead={toggleRead}
      />

      {/* Bottom spacing for mobile footer */}
      <div className="pb-20" />
    </div>
  );
}
