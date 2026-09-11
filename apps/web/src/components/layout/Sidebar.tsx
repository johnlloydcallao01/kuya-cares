'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { SidebarProps } from '@/types';
import { SidebarItem } from '@/components/ui';

/**
 * Sidebar component with navigation items
 *
 * @param isOpen - Whether the sidebar is currently open
 * @param onToggle - Function to toggle sidebar state
 * @param onScroll - Optional function to handle scroll events for position persistence
 */
export function Sidebar({ isOpen, onToggle, onScroll }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      <aside
        data-sidebar="main"
        className={`fixed left-0 bg-white border-r border-gray-200 transition-all duration-300 overflow-y-auto z-40 hidden lg:block ${
          isOpen
            ? 'w-60 translate-x-0'
            : 'w-20 translate-x-0'
        }`}
        style={{
          height: 'calc(100vh - 4rem)',
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 transparent'
        }}
        onScroll={onScroll}
      >
      <div className="p-3">
        <nav className="space-y-1">
          {/* Main Navigation */}
          <div className="space-y-1">
            <SidebarItem
              icon="home"
              label="Home"
              active={pathname === '/'}
              collapsed={!isOpen}
              href="/"
            />
            <SidebarItem
              icon="history"
              label="Recently Viewed"
              active={pathname === '/recently-viewed'}
              collapsed={!isOpen}
              href="/recently-viewed"
            />

          </div>

          {isOpen && <hr className="my-3 border-gray-200" />}

          {/* Account section */}
          <div className="space-y-1">
            {isOpen && <div className="px-3 py-2 text-sm font-medium text-gray-900">Account</div>}
            <SidebarItem 
              icon="receipt" 
              label="Orders" 
              active={pathname === '/orders'}
              collapsed={!isOpen} 
              href="/orders" 
            />
            <SidebarItem 
              icon="heart" 
              label="Wishlists" 
              active={pathname === '/wishlists'}
              collapsed={!isOpen} 
              href="/wishlists" 
            />
            <SidebarItem 
              icon="location" 
              label="Addresses" 
              active={pathname === '/addresses'}
              collapsed={!isOpen} 
              href="/addresses" 
            />
            <SidebarItem 
              icon="billing" 
              label="Wallets" 
              active={pathname === '/wallets'}
              collapsed={!isOpen} 
              href="/wallets" 
            />
            <SidebarItem 
              icon="settings" 
              label="Settings" 
              active={pathname === '/settings'}
              collapsed={!isOpen} 
              href="/settings" 
            />
          </div>

          {isOpen && <hr className="my-3 border-gray-200" />}

          {/* Perks section */}
          <div className="space-y-1">
            {isOpen && <div className="px-3 py-2 text-sm font-medium text-gray-900">Perks</div>}
            <SidebarItem
              icon="voucher"
              label="Vouchers"
              href="/vouchers"
              active={pathname === '/vouchers'}
              collapsed={!isOpen}
            />
            <SidebarItem
              icon="coupon"
              label="Coupons"
              href="/coupons"
              active={pathname === '/coupons'}
              collapsed={!isOpen}
            />
            <SidebarItem
              icon="points"
              label="Points"
              href="/points"
              active={pathname === '/points'}
              collapsed={!isOpen}
            />
            <SidebarItem
              icon="invite"
              label="Invite Friends"
              href="/invite-friends"
              active={pathname === '/invite-friends'}
              collapsed={!isOpen}
            />
          </div>

          {isOpen && <hr className="my-3 border-gray-200" />}

          {/* General section */}
          <div className="space-y-1">
            {isOpen && <div className="px-3 py-2 text-sm font-medium text-gray-900">General</div>}
            <SidebarItem
              icon="help"
              label="Help Center"
              href="/help"
              active={pathname === '/help'}
              collapsed={!isOpen}
            />
            <SidebarItem
              icon="terms"
              label="Terms and Conditions"
              href="/terms"
              active={pathname === '/terms'}
              collapsed={!isOpen}
            />
            <SidebarItem
              icon="privacy"
              label="Privacy Policy"
              href="/privacy"
              active={pathname === '/privacy'}
              collapsed={!isOpen}
            />
            <SidebarItem
              icon="logout"
              label="Logout"
              href="/logout"
              active={pathname === '/logout'}
              collapsed={!isOpen}
            />
          </div>




        </nav>
      </div>
    </aside>
    </>
  );
}
