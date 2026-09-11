'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { SidebarItem } from '@/components/ui';

interface OverlaySidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Overlay Sidebar component that appears as a popup from the left
 * Contains the same navigation items as the main sidebar
 */
export function OverlaySidebar({ isOpen, onClose }: OverlaySidebarProps) {
  const pathname = usePathname();

  // Close overlay when pressing Escape
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Close overlay when clicking outside the sidebar
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const sidebar = document.querySelector('[data-overlay-sidebar]');
      const toggleButton = document.querySelector('[aria-label*="sidebar"]'); // Find the toggle button
      
      if (isOpen && sidebar && !sidebar.contains(e.target as Node) && 
          toggleButton && !toggleButton.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <>
      {/* Sidebar */}
      <aside
        data-overlay-sidebar
        className={`fixed left-0 top-16 bg-white border-r border-gray-200 transition-transform duration-300 overflow-y-auto z-50 w-60 shadow-xl ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          height: 'calc(100vh - 4rem)',
          scrollbarWidth: 'thin',
          scrollbarColor: '#cbd5e1 transparent'
        }}
      >


        <div className="p-3">
          <nav className="space-y-1">
            {/* Main Navigation */}
            <div className="space-y-1">
              <SidebarItem
                icon="home"
                label="Home"
                active={pathname === '/'}
                collapsed={false}
                href="/"
                onClick={onClose}
              />
              <SidebarItem
                icon="history"
                label="Recently Viewed"
                active={pathname === '/recently-viewed'}
                collapsed={false}
                href="/recently-viewed"
                onClick={onClose}
              />
          </div>

          <hr className="my-3 border-gray-200" />

          {/* Perks section */}
          <div className="space-y-1">
            <div className="px-3 py-2 text-sm font-medium text-gray-900">Perks</div>
            <SidebarItem
              icon="voucher"
              label="Vouchers"
              href="/vouchers"
              active={pathname === '/vouchers'}
              collapsed={false}
              onClick={onClose}
            />
            <SidebarItem
              icon="coupon"
              label="Coupons"
              href="/coupons"
              active={pathname === '/coupons'}
              collapsed={false}
              onClick={onClose}
            />
            <SidebarItem
              icon="points"
              label="Points"
              href="/points"
              active={pathname === '/points'}
              collapsed={false}
              onClick={onClose}
            />
            <SidebarItem
              icon="invite"
              label="Invite Friends"
              href="/invite-friends"
              active={pathname === '/invite-friends'}
              collapsed={false}
              onClick={onClose}
            />
          </div>

            <hr className="my-3 border-gray-200" />

            {/* Account section */}
            <div className="space-y-1">
              <div className="px-3 py-2 text-sm font-medium text-gray-900">Account</div>
              <SidebarItem 
                icon="receipt" 
                label="Orders" 
                active={pathname === '/orders'}
                collapsed={false} 
                href="/orders" 
                onClick={onClose}
              />
              <SidebarItem 
                icon="heart" 
                label="Wishlists" 
                active={pathname === '/wishlists'}
                collapsed={false} 
                href="/wishlists" 
                onClick={onClose}
              />
              <SidebarItem 
                icon="location" 
                label="Addresses" 
                active={pathname === '/addresses'}
                collapsed={false} 
                href="/addresses" 
                onClick={onClose}
              />
              <SidebarItem 
                icon="billing" 
                label="Wallets" 
                active={pathname === '/wallets'}
                collapsed={false} 
                href="/wallets" 
                onClick={onClose}
              />
              <SidebarItem 
                icon="settings" 
                label="Settings" 
                active={pathname === '/settings'}
                collapsed={false} 
                href="/settings" 
                onClick={onClose}
              />
            </div>

            <hr className="my-3 border-gray-200" />

            {/* General section */}
            <div className="space-y-1">
              <div className="px-3 py-2 text-sm font-medium text-gray-900">General</div>
              <SidebarItem
                icon="help"
                label="Help Center"
                href="/help"
                active={pathname === '/help'}
              />
              <SidebarItem
                icon="terms"
                label="Terms and Conditions"
                href="/terms"
                active={pathname === '/terms'}
              />
              <SidebarItem
                icon="privacy"
                label="Privacy Policy"
                href="/privacy"
                active={pathname === '/privacy'}
              />
              <SidebarItem
                icon="logout"
                label="Logout"
                href="/logout"
                active={pathname === '/logout'}
              />
            </div>
          </nav>
        </div>
      </aside>
    </>
  );
}
