'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { NotificationList } from '@/components/notifications/NotificationList';
import { useNotifications } from '@/contexts/NotificationsContext';

interface NotificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Desktop notification modal — preserves popup shell styling
 * (absolute w-96 shadow-2xl) but renders the SAME shared
 * NotificationList content as /notifications page.
 * Full behavior parity with mobile NotificationsScreen.
 */
export function NotificationPopup({ isOpen, onClose }: NotificationPopupProps) {
  const router = useRouter();
  const { notifications, unreadCount, isLoading, markAllAsRead, toggleRead } =
    useNotifications();

  if (!isOpen) return null;

  const recentNotifications = notifications.slice(0, 50);

  const handleViewAll = () => {
    router.push('/notifications' as any);
    onClose();
  };

  return (
    <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-[#111111] rounded-xl shadow-2xl border border-gray-200 dark:border-[#292929] z-50 overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-[#292929] bg-white dark:bg-[#111111]">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>
        {unreadCount > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Shared content — same as /notifications page */}
      <div className="max-h-[480px] overflow-y-auto">
        <NotificationList
          notifications={recentNotifications}
          unreadCount={0}
          isLoading={isLoading}
          onMarkAllAsRead={markAllAsRead}
          onToggleRead={toggleRead}
          compact
        />
      </div>

      {/* Footer */}
      {recentNotifications.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 dark:border-[#292929] bg-gray-50 dark:bg-[#171717]">
          <button
            onClick={handleViewAll}
            className="w-full text-center text-sm font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors py-1"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}
