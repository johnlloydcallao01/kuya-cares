'use client';

import React, { useState } from 'react';
import Image from 'next/image';

/**
 * Professional Notifications Page
 * Mobile-optimized with comprehensive notification management
 */

// Mock notification data
const mockNotifications = [
  {
    id: 1,
    type: 'order_completed',
    title: 'Order Delivered!',
    message: 'Your order from Alvin\'s Pizza has been successfully delivered',
    timestamp: '2 hours ago',
    read: false,
    icon: 'fa-check-circle',
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
    actionText: 'View Order',
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
    actionText: 'View Offers',
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
    actionText: 'Browse Products',
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
    actionText: 'Track Order',
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
    actionText: 'Learn More',
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
    actionText: 'Complete Order',
    actionPath: '/carts'
  },
  {
    id: 7,
    type: 'achievement',
    title: 'Loyalty Milestone!',
    message: 'You\'ve earned the "Frequent Shopper" badge for placing 10 orders',
    timestamp: '1 week ago',
    read: true,
    icon: 'fa-trophy',
    iconColor: 'text-yellow-600',
    iconBg: 'bg-yellow-100',
    actionText: 'View Rewards',
    actionPath: '/rewards'
  },
  {
    id: 8,
    type: 'payment',
    title: 'Payment Successful',
    message: 'Your payment for order #12345 has been processed successfully',
    timestamp: '1 week ago',
    read: true,
    icon: 'fa-credit-card',
    iconColor: 'text-green-600',
    iconBg: 'bg-green-100',
    actionText: 'View Receipt',
    actionPath: '/billing'
  }
];

const notificationTypes = [
  { id: 'all', label: 'All', count: mockNotifications.length },
  { id: 'unread', label: 'Unread', count: mockNotifications.filter(n => !n.read).length },
  { id: 'order_completed', label: 'Orders', count: mockNotifications.filter(n => n.type === 'order_completed').length },
  { id: 'promotion', label: 'Promotions', count: mockNotifications.filter(n => n.type === 'promotion').length },
  { id: 'system_update', label: 'Updates', count: mockNotifications.filter(n => n.type === 'system_update').length }
];

export default function NotificationsPage() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [notifications, setNotifications] = useState(mockNotifications);

  const filteredNotifications = notifications.filter(notification => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'unread') return !notification.read;
    return notification.type === selectedFilter;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: number) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
  };

  const deleteNotification = (id: number) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const getTimeAgo = (timestamp: string) => {
    return timestamp;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 pt-8 pb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
              <p className="text-gray-600 text-sm mt-1">
                {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up!'}
              </p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="px-3 py-1.5 bg-[#201a7c] text-white rounded-lg text-sm font-medium hover:bg-[#1a1569] transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 py-3">
          <div className="flex overflow-x-auto space-x-1 pb-2">
            {notificationTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedFilter(type.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center space-x-2 ${
                  selectedFilter === type.id
                    ? 'bg-[#201a7c] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>{type.label}</span>
                {type.count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    selectedFilter === type.id
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {type.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="px-4 py-6">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa fa-bell-slash text-gray-400 text-2xl"></i>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
            <p className="text-gray-500">
              {selectedFilter === 'unread' ? 'All notifications have been read' : 'You\'re all caught up!'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`bg-white rounded-lg border border-gray-200 overflow-hidden transition-all duration-200 ${
                  !notification.read ? 'border-l-4 border-l-[#201a7c] shadow-sm' : 'hover:shadow-sm'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start space-x-3">
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${notification.iconBg}`}>
                      <i className={`fa ${notification.icon} ${notification.iconColor}`}></i>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className={`text-sm font-semibold ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                            {notification.title}
                          </h3>
                          <p className={`text-sm mt-1 ${!notification.read ? 'text-gray-700' : 'text-gray-600'}`}>
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">{getTimeAgo(notification.timestamp)}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2 ml-4">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors"
                              title="Mark as read"
                            >
                              <i className="fa fa-check text-blue-600 text-xs"></i>
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-red-100 transition-colors group"
                            title="Delete notification"
                          >
                            <i className="fa fa-trash text-gray-400 group-hover:text-red-500 text-xs"></i>
                          </button>
                        </div>
                      </div>

                      {/* Action Button */}
                      {notification.actionText && (
                        <div className="mt-3">
                          <button className="text-sm font-medium text-[#201a7c] hover:text-[#1a1569] transition-colors">
                            {notification.actionText} →
                          </button>
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

      {/* Bottom spacing for mobile footer */}
      <div className="pb-20"></div>
    </div>
  );
}
