'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from '@/components/ui/ImageWrapper';
import { useRouter } from 'next/navigation';
import { useLogout, useUser } from '@/hooks/useAuth';
import {
  asObject,
  fetchAccountOverview,
  formatPHPPrice,
  type AccountOverview,
} from '@/lib/client-services/account-service';

/**
 * Production Account Menu — mirrors apps/mobile-customer AccountScreen
 * (Menu tab → Account): real user, real customer/active-address,
 * real stats (orders / spent / reviews / favorites), real badges.
 */

function MenuSkeleton() {
  return (
    <div className="px-4 py-6 space-y-4">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse">
        <div className="flex items-center">
          <div className="w-[72px] h-[72px] rounded-full bg-gray-200 mr-4" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-3/5 bg-gray-100 rounded" />
            <div className="h-3.5 w-4/5 bg-gray-100 rounded" />
            <div className="h-3 w-2/5 bg-gray-100 rounded" />
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
          <div className="h-3 w-1/3 bg-gray-100 rounded" />
          <div className="h-3.5 w-4/5 bg-gray-100 rounded" />
        </div>
      </div>
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 animate-pulse">
        <div className="h-4 w-1/3 bg-gray-100 rounded mb-4" />
        <div className="flex justify-around">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-1">
              <div className="w-12 h-6 bg-gray-200 rounded" />
              <div className="w-10 h-3 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 animate-pulse">
        <div className="p-5 pb-3">
          <div className="h-4 w-1/3 bg-gray-100 rounded" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center px-5 py-4 border-t border-gray-100 first:border-t-0">
            <div className="w-[22px] h-[22px] rounded-md bg-gray-200 mr-3.5" />
            <div className="h-4 w-2/5 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MenuPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useUser();
  const { logout, isLoggingOut } = useLogout();

  const [overview, setOverview] = useState<AccountOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Guest';
  const email = user?.email || '';
  const profileImageUrl =
    user?.profilePicture?.cloudinaryURL || user?.profilePicture?.url || null;
  const initials = displayName.charAt(0).toUpperCase() || 'G';
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : null;

  const activeAddress = overview?.customer?.activeAddress
    ? asObject(overview.customer.activeAddress)
    : null;
  const formattedAddress =
    activeAddress?.formatted_address || activeAddress?.formattedAddress || null;

  const loadData = useCallback(async () => {
    if (!user?.id) {
      setOverview(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const data = await fetchAccountOverview(user.id);
      setOverview(data);
    } catch (err) {
      console.error('Failed to load account overview:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthLoading) loadData();
  }, [isAuthLoading, loadData]);

  const handleMenuItemClick = (path: string) => {
    router.push(path as any);
  };

  if (isAuthLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <h1 className="text-2xl font-bold text-gray-900">Account</h1>
        </div>
        <MenuSkeleton />
      </div>
    );
  }

  const stats = overview?.stats;

  const quickActions: {
    icon: string;
    label: string;
    badge?: number;
    path: string;
  }[] = [
    {
      icon: 'fa-receipt',
      label: 'My Orders',
      badge: stats?.orderCount,
      path: '/orders',
    },
    {
      icon: 'fa-heart',
      label: 'Favorites',
      badge: stats?.favoriteCount,
      path: '/wishlists',
    },
    {
      icon: 'fa-bell',
      label: 'Notifications',
      badge: stats?.unreadNotificationCount,
      path: '/notifications',
    },
    {
      icon: 'fa-location-dot',
      label: 'Delivery Addresses',
      badge: stats?.addressCount,
      path: '/addresses',
    },
    {
      icon: 'fa-pen-to-square',
      label: 'Edit Profile',
      path: '/settings',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — same as mobile AccountScreen */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-2xl font-bold text-gray-900">Account</h1>
      </div>

      <div className="px-4 py-4 pb-24 space-y-4">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center">
            {profileImageUrl ? (
              <div className="w-[72px] h-[72px] rounded-full overflow-hidden mr-4 shrink-0">
                <Image
                  src={profileImageUrl}
                  alt={displayName}
                  width={72}
                  height={72}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-[72px] h-[72px] rounded-full mr-4 shrink-0 bg-green-50 flex items-center justify-center">
                <span className="text-[28px] font-bold text-[#239459]">{initials}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 truncate">{displayName}</h2>
              {!!email && <p className="text-sm text-gray-500 truncate mt-0.5">{email}</p>}
              {memberSince && (
                <p className="text-xs text-gray-500 mt-1">Member since {memberSince}</p>
              )}
            </div>
          </div>

          {/* Active Delivery Address */}
          <button
            type="button"
            onClick={() => handleMenuItemClick('/addresses')}
            className="mt-4 pt-4 border-t border-gray-100 w-full flex items-start text-left hover:bg-gray-50 transition-colors rounded-lg"
          >
            <i
              className={`fa fa-location-dot text-[18px] mt-0.5 mr-2.5 ${
                formattedAddress ? 'text-[#239459]' : 'text-gray-400'
              }`}
            />
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-0.5">
                Delivery Address
              </span>
              <span
                className={`block text-sm leading-5 line-clamp-2 ${
                  formattedAddress ? 'text-gray-900' : 'text-gray-500'
                }`}
              >
                {formattedAddress || 'No delivery address set yet'}
              </span>
            </span>
            <i className="fa fa-chevron-right text-gray-400 text-xs ml-2 mt-1" />
          </button>
        </div>

        {/* Stats Row — Orders / Total Spent / Reviews / Favorites */}
        {stats && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-base font-bold text-gray-900 mb-4">Your Stats</h3>
            <div className="flex justify-around">
              <div className="flex flex-col items-center flex-1">
                <span className="text-2xl font-bold text-[#239459]">{stats.orderCount}</span>
                <span className="text-xs text-gray-500 mt-1">Orders</span>
              </div>
              <div className="flex flex-col items-center flex-1 min-w-0 px-1">
                <span className="text-[22px] leading-7 font-bold text-green-600 truncate max-w-full">
                  {stats.totalSpent > 0 ? formatPHPPrice(stats.totalSpent) : '—'}
                </span>
                <span className="text-xs text-gray-500 mt-1">Total Spent</span>
              </div>
              <div className="flex flex-col items-center flex-1">
                <span className="text-2xl font-bold text-purple-600">{stats.reviewCount}</span>
                <span className="text-xs text-gray-500 mt-1">Reviews</span>
              </div>
              <div className="flex flex-col items-center flex-1">
                <span className="text-2xl font-bold text-orange-500">{stats.favoriteCount}</span>
                <span className="text-xs text-gray-500 mt-1">Favorites</span>
              </div>
            </div>
          </div>
        )}

        {/* My Account actions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <h3 className="text-base font-bold text-gray-900 px-5 pt-5 pb-3">My Account</h3>
          {quickActions.map((item, idx) => (
            <button
              key={item.label}
              onClick={() => handleMenuItemClick(item.path)}
              className={`w-full flex items-center px-5 py-4 hover:bg-gray-50 transition-colors ${
                idx > 0 ? 'border-t border-gray-100' : ''
              }`}
            >
              <i className={`fa ${item.icon} text-[22px] text-gray-500 w-[22px] text-center`} />
              <span className="flex-1 ml-3.5 text-left text-base text-gray-900">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="bg-[#239459] min-w-[22px] h-[22px] rounded-full flex items-center justify-center px-1.5 mr-2">
                  <span className="text-white text-xs font-bold">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                </span>
              )}
              <i className="fa fa-chevron-right text-gray-400 text-xs" />
            </button>
          ))}
        </div>

        {/* Sign Out */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button
            onClick={async () => {
              try {
                await logout();
              } catch (error) {
                console.error('Logout failed:', error);
              }
            }}
            disabled={isLoggingOut}
            className="w-full flex items-center justify-center px-4 py-5 text-base text-red-500 font-semibold hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {isLoggingOut ? 'Signing out...' : 'Sign Out'}
          </button>
        </div>
      </div>
    </div>
  );
}
