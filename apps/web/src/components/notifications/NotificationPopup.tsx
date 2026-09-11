'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  icon: string;
  iconColor: string;
  iconBg: string;
  actionPath?: string;
}

interface NotificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAsRead: (id: number) => void;
  onMarkAllAsRead: () => void;
}

export function NotificationPopup({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead
}: NotificationPopupProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const unreadCount = notifications.filter(n => !n.read).length;
  const recentNotifications = notifications.slice(0, 6);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    if (notification.actionPath) {
      router.push(notification.actionPath);
      onClose();
    }
  };

  const handleViewAll = () => {
    router.push('/notifications');
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
              onClick={onMarkAllAsRead}
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

      {/* Notifications List */}
      <div className="max-h-[480px] overflow-y-auto">
        {recentNotifications.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="fa fa-bell-slash text-gray-400 text-2xl"></i>
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">No notifications</p>
            <p className="text-xs text-gray-500">You&apos;re all caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`px-4 py-3 hover:bg-gray-50 transition-colors cursor-pointer ${!notification.read ? 'bg-blue-50/50' : ''
                  }`}
              >
                <div className="flex items-start space-x-3">
                  {/* Icon */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${notification.iconBg}`}>
                    <i className={`fa ${notification.icon} ${notification.iconColor} text-sm`}></i>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-2">
                        <p className={`text-sm font-semibold ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                          {notification.title}
                        </p>
                        <p className={`text-sm mt-0.5 line-clamp-2 ${!notification.read ? 'text-gray-700' : 'text-gray-600'}`}>
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1.5 flex items-center">
                          <i className="far fa-clock mr-1"></i>
                          {notification.timestamp}
                        </p>
                      </div>

                      {/* Unread Indicator */}
                      {!notification.read && (
                        <div className="flex-shrink-0">
                          <div className="w-2.5 h-2.5 bg-blue-600 rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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

// Mock notification data for the popup
export const mockNotifications: Notification[] = [
  {
    id: 1,
    type: 'order_completed',
    title: 'Order Delivered!',
    message: "Your order from Alvin's Pizza has been successfully delivered",
    timestamp: '2 hours ago',
    read: false,
    icon: 'fa-check-circle',
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
    actionPath: '/orders'
  },
  {
    id: 2,
    type: 'promotion',
    title: 'Special Offer!',
    message: 'Get 20% off your next order from participating merchants',
    timestamp: '4 hours ago',
    read: false,
    icon: 'fa-tag',
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-100',
    actionPath: '/promotions'
  },
  {
    id: 3,
    type: 'new_merchant',
    title: 'New Merchant Available',
    message: 'Check out the new "Fresh Seafood Market" now available in your area',
    timestamp: '1 day ago',
    read: true,
    icon: 'fa-store',
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-100',
    actionPath: '/merchants'
  },
  {
    id: 4,
    type: 'order_update',
    title: 'Order Update',
    message: 'Your order is being prepared and will be ready for pickup soon',
    timestamp: '2 days ago',
    read: true,
    icon: 'fa-clock',
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-100',
    actionPath: '/orders'
  },
  {
    id: 5,
    type: 'system_update',
    title: 'App Update',
    message: 'New features have been added to improve your shopping experience',
    timestamp: '3 days ago',
    read: true,
    icon: 'fa-sync-alt',
    iconColor: 'text-indigo-600',
    iconBg: 'bg-indigo-100',
    actionPath: '/updates'
  },
  {
    id: 6,
    type: 'reminder',
    title: 'Cart Reminder',
    message: 'You have items in your cart waiting to be ordered',
    timestamp: '5 days ago',
    read: true,
    icon: 'fa-shopping-cart',
    iconColor: 'text-yellow-600',
    iconBg: 'bg-yellow-100',
    actionPath: '/carts'
  }
];
