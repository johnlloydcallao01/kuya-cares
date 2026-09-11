'use client';

import React, { useState } from 'react';
import Image from "@/components/ui/ImageWrapper";
import { useRouter } from 'next/navigation';
import { useLogout } from '@/hooks/useAuth';

/**
 * Professional Menu Page - Facebook-style user menu
 * Mobile-optimized with comprehensive app navigation and user options
 */

// Mock user data
const mockUser = {
  name: 'Alex Customer',
  email: 'alex.customer@example.com',
  rank: 'Premium Member',
  company: 'Tap2Go Customer',
  avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face',
  memberSince: '2023',
  ordersCompleted: 8,
  rewardsEarned: 6
};

// Menu sections data
const menuSections = [
  {
    title: 'Shopping',
    items: [
      { icon: 'fa-shopping-bag', label: 'My Orders', path: '/orders', badge: '3' },
      { icon: 'fa-heart', label: 'Wishlist', path: '/wishlist', badge: null },
      { icon: 'fa-shopping-cart', label: 'Carts', path: '/carts', badge: null },
      { icon: 'fa-store', label: 'Browse Merchants', path: '/merchants', badge: '12' },
      { icon: 'fa-history', label: 'Order History', path: '/history', badge: null }
    ]
  },
  {
    title: 'Account',
    items: [
      { icon: 'fa-user-edit', label: 'Edit Profile', path: '/profile', badge: null },
      { icon: 'fa-cog', label: 'Settings', path: '/settings', badge: null },
      { icon: 'fa-bell', label: 'Notifications', path: '/notifications', badge: '5' },
      { icon: 'fa-credit-card', label: 'Billing & Payments', path: '/billing', badge: null },
      { icon: 'fa-shield-alt', label: 'Privacy & Security', path: '/privacy', badge: null }
    ]
  },
  {
    title: 'Support',
    items: [
      { icon: 'fa-question-circle', label: 'Help Center', path: '/help', badge: null },
      { icon: 'fa-comments', label: 'Contact Support', path: '/support', badge: null },
      { icon: 'fa-bug', label: 'Report Issue', path: '/report', badge: null },
      { icon: 'fa-star', label: 'Rate App', path: '/rate', badge: null }
    ]
  },
  {
    title: 'More',
    items: [
      { icon: 'fa-users', label: 'Invite Friends', path: '/invite', badge: null },
      { icon: 'fa-share-alt', label: 'Share App', path: '/share', badge: null },
      { icon: 'fa-info-circle', label: 'About', path: '/about', badge: null },
      { icon: 'fa-file-alt', label: 'Terms & Privacy', path: '/terms', badge: null }
    ]
  }
];

export default function MenuPage() {
  const router = useRouter();
  const { logout, isLoggingOut } = useLogout();

  const handleMenuItemClick = (path: string) => {
    router.push(path as any);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* User Profile Section */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 pt-8 pb-6">
          {/* Page Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
            <p className="text-gray-600 text-sm mt-1">Account and app settings</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-gray-200">
              <Image
                src={mockUser.avatar}
                alt={mockUser.name}
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900">{mockUser.name}</h2>
              <p className="text-sm text-gray-600">{mockUser.rank}</p>
              <p className="text-sm text-gray-500">{mockUser.company}</p>
            </div>
            <button 
              onClick={() => handleMenuItemClick('/profile')}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <i className="fa fa-chevron-right text-gray-600 text-sm"></i>
            </button>
          </div>
          
          {/* Quick Stats */}
          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-lg font-bold text-[#201a7c]">{mockUser.ordersCompleted}</div>
              <div className="text-xs text-gray-600">Orders</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-lg font-bold text-green-600">{mockUser.rewardsEarned}</div>
              <div className="text-xs text-gray-600">Rewards</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-lg font-bold text-purple-600">{mockUser.memberSince}</div>
              <div className="text-xs text-gray-600">Member Since</div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Sections */}
      <div className="px-4 py-6">
        {menuSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 px-2">{section.title}</h3>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {section.items.map((item, itemIndex) => (
                <button
                  key={itemIndex}
                  onClick={() => handleMenuItemClick(item.path)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                      <i className={`fa ${item.icon} text-gray-600`}></i>
                    </div>
                    <span className="font-medium text-gray-900">{item.label}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {item.badge && (
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full min-w-[20px] text-center">
                        {item.badge}
                      </span>
                    )}
                    <i className="fa fa-chevron-right text-gray-400 text-sm"></i>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}


      </div>

      {/* Sign Out Section */}
      <div className="px-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-t border-gray-100 py-1">
            <button
              onClick={async () => {
                try {
                  await logout();
                } catch (error) {
                  console.error('Logout failed:', error);
                }
              }}
              disabled={isLoggingOut}
              className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {isLoggingOut ? (
                <svg className="w-4 h-4 mr-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              )}
              {isLoggingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      </div>

      {/* App Info */}
      <div className="px-4 pb-20">
        <div className="text-center text-gray-500 text-sm">
          <p>Grandline Maritime Training</p>
          <p>Version 1.0.0</p>
          <p className="mt-2">© 2024 Grandline Maritime Training Center</p>
        </div>
      </div>


    </div>
  );
}
