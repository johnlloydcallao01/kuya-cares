'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { SidebarItem } from '../ui/SidebarItem';
import { useAuthActions } from '@/hooks/useAuth';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuthActions();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  return (
    <>
      <aside
        className={`fixed left-0 top-16 bg-white border-r border-gray-200 transition-all duration-300 overflow-y-auto z-40 hidden lg:block ${
          isOpen ? 'w-64' : 'w-20'
        }`}
        style={{ height: 'calc(100vh - 4rem)' }}
      >
        <div className="p-4">
          <div className="space-y-1">
            <SidebarItem
              icon="home"
              label="Dashboard"
              active={pathname === '/dashboard'}
              collapsed={!isOpen}
              href="/dashboard"
            />
            <SidebarItem
              icon="map"
              label="Map View"
              active={pathname === '/map'}
              collapsed={!isOpen}
              href="/dashboard" // Keeping as dashboard for now since map is there
            />
             <SidebarItem
              icon="history"
              label="History"
              active={pathname === '/history'}
              collapsed={!isOpen}
              href="/history"
            />
          </div>

          {isOpen && <hr className="my-4 border-gray-200" />}

          <div className="space-y-1">
            {isOpen && <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</div>}
            <SidebarItem
              icon="settings"
              label="Settings"
              active={pathname === '/settings'}
              collapsed={!isOpen}
              href="/settings"
            />
            <SidebarItem
              icon="logout"
              label="Logout"
              collapsed={!isOpen}
              onClick={handleLogout}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
