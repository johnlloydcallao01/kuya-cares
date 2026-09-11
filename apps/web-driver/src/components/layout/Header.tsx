'use client';

import React from 'react';
import Link from 'next/link';
import { getIcon } from '../ui/icons';
import { useUser } from '@/hooks/useAuth';

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export function Header({ sidebarOpen, onToggleSidebar }: HeaderProps) {
  const { user } = useUser();
  const displayName = user ? `${user.firstName} ${user.lastName}` : 'Driver Account';

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 px-4 flex items-center justify-between">
      <div className="flex items-center">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none lg:mr-4"
        >
          {getIcon('menu')}
        </button>
        
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            D
          </div>
          <span className="text-xl font-bold text-gray-900 hidden sm:block">
            Tap2Go Driver
          </span>
        </Link>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600">
            {getIcon('user')}
          </div>
          <span className="text-sm font-medium text-gray-700 hidden md:block">
            {displayName}
          </span>
        </div>
      </div>
    </header>
  );
}
