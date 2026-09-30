'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  formatNotificationTime,
  getDomainStyle,
  type NotificationItem,
} from '@/lib/client-services/notification-service';

interface NotificationListProps {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  refreshing?: boolean;
  onMarkAllAsRead: () => void;
  onToggleRead: (id: string) => void;
  compact?: boolean;
}

/**
 * Shared notification content — same data, behavior, and appearance as
 * mobile NotificationsScreen. Used by both /notifications page and the
 * desktop modal (NotificationPopup).
 */
export function NotificationList({
  notifications,
  unreadCount,
  isLoading,
  refreshing = false,
  onMarkAllAsRead,
  onToggleRead,
  compact = false,
}: NotificationListProps) {
  const router = useRouter();

  const handlePress = (item: NotificationItem) => {
    if (item.status === 'unread') {
      onToggleRead(item.id);
    }
    if (item.orderId) {
      router.push(`/orders/${item.orderId}` as any);
    }
  };

  if (isLoading && !refreshing) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-[#239459] rounded-full animate-spin" />
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center px-8 py-12 text-center">
        <div className="w-[120px] h-[120px] bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <i className="fa fa-bell text-gray-400 text-4xl" />
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">No notifications yet</h3>
        <p className="text-gray-500 leading-6">
          We&apos;ll notify you about order updates, promotions, and more!
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? '' : 'p-4 space-y-3'}>
      {unreadCount > 0 && (
        <div
          className={
            compact
              ? 'px-4 py-3 bg-amber-50 border-b border-amber-200'
              : 'rounded-lg px-4 py-3 bg-amber-50 border border-amber-200'
          }
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-amber-800">
              You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </p>
            <button
              onClick={onMarkAllAsRead}
              className="shrink-0 text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900"
            >
              Mark all read
            </button>
          </div>
        </div>
      )}

      <div className={compact ? 'divide-y divide-gray-100' : 'space-y-3'}>
        {notifications.map((item) => {
          const isUnread = item.status === 'unread';
          const style = getDomainStyle(item.domain);
          return (
            <div
              key={item.id}
              onClick={() => handlePress(item)}
              className={
                compact
                  ? `px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${
                      isUnread ? 'bg-emerald-50/50' : ''
                    }`
                  : `rounded-xl p-4 cursor-pointer transition-colors border-l-4 shadow-sm ${
                      isUnread
                        ? 'bg-emerald-50 border-l-[#239459] border-t border-r border-b border-gray-100'
                        : 'bg-white border-l-gray-200 border border-gray-100'
                    }`
              }
            >
              <div className="flex items-start">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 mr-3 ${style.bg}`}
                >
                  <i className={`fa ${style.icon} ${style.color} text-sm`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p
                      className={`text-base flex-1 ${
                        isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'
                      }`}
                    >
                      {item.title}
                    </p>
                    {isUnread && (
                      <span className="w-2 h-2 bg-[#239459] rounded-full shrink-0 mt-1.5 ml-2" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 leading-5 mb-2">{item.body}</p>
                  <p className="text-xs font-medium text-gray-500">
                    {formatNotificationTime(item.deliveredAt)}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleRead(item.id);
                    }}
                    className="inline-flex items-center self-start mt-3 bg-white px-2.5 py-1.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <i
                      className={`fa ${
                        isUnread ? 'fa-check-circle' : 'fa-rotate-left'
                      } text-sm text-gray-500`}
                    />
                    <span className="text-xs font-semibold text-gray-500 ml-1">
                      {isUnread ? 'Mark as read' : 'Mark as unread'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
