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
    <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-fadeIn">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>
        {unreadCount > 0 && (
          <p className="text-xs text-gray-500 mt-1">
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
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleViewAll}
            className="w-full text-center text-sm font-semibold text-blue-600 hover:text-blue-700 transition-colors py-1"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}
