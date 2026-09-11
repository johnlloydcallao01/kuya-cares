import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { HeaderProps } from '@/types';
import { User, Settings, Search } from '@/components/ui/IconWrapper';
import LogoutButton from '@/components/LogoutButton';
import { useAuth, getFullName, getUserInitials } from '@/hooks/useAuth';
import { SearchBar } from '@/components/search/SearchBar';
import SearchModal from '@/components/search/SearchModal';
import { NotificationBell } from '@/components/notifications/NotificationBell';

/**
 * Admin Header component with navigation, search, and user controls
 *
 * @param sidebarOpen - Whether the sidebar is currently open
 * @param onToggleSidebar - Function to toggle sidebar state
 */
export function Header({
  sidebarOpen,
  onToggleSidebar,
  onToggleMobileSidebar,
}: HeaderProps) {
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const { user, isLoading } = useAuth();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const toggleProfileDropdown = () => {
    setIsProfileDropdownOpen(!isProfileDropdownOpen);
  };

  const displayName = isLoading ? '...' : getFullName(user);
  const initials = isLoading ? '?' : getUserInitials(user);
  const avatarBgColor = 'bg-blue-600';

  return (
    <>
      <header className="sticky top-0 h-[57px] sm:h-[65px] bg-white dark:bg-[#171717] border-b border-gray-200 dark:border-[#262626] z-50">
        <div className="flex items-center justify-between h-full px-3 sm:px-4 gap-2">
          {/* Left section */}
          <div className="flex items-center space-x-4">
            {/* Mobile hamburger — visible <lg, controls drawer */}
            <button
              onClick={onToggleMobileSidebar}
              className="p-1.5 rounded-lg text-gray-500 dark:text-[#a1a1aa] hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#262626] lg:hidden"
              aria-label="Open navigation menu"
              aria-expanded={false}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* Desktop collapse toggle — visible lg+ */}
            <button
              onClick={onToggleSidebar}
              className="hidden lg:inline-flex p-1.5 rounded-lg text-gray-500 dark:text-[#a1a1aa] hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#262626]"
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              aria-expanded={sidebarOpen}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* tap2go Logo */}
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 relative flex-shrink-0">
                <Image
                  src="/logo.png"
                  alt="tap2go"
                  width={40}
                  height={40}
                  className="rounded-lg object-contain"
                  priority
                />
              </div>
              <span className="text-xl font-semibold text-gray-900 dark:text-white">tap2go</span>
            </div>
          </div>

          {/* Center section - Desktop search bar with inline dropdown */}
          <div className="flex-1 flex justify-center max-w-xl mx-4">
            <SearchBar />
          </div>

          {/* Mobile search trigger - opens full-screen modal */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsMobileSearchOpen(true)}
              className="p-2 rounded-lg text-gray-500 dark:text-[#a1a1aa] hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#262626]"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>

          {/* Right section */}
          <div className="flex items-center space-x-3">
            <NotificationBell />
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={toggleProfileDropdown}
                className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#262626] transition-colors"
              >
                {isLoading ? (
                  <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
                ) : user?.profilePicture?.url ? (
                  <div className="w-8 h-8 rounded-full overflow-hidden">
                    <img
                      src={user.profilePicture.url}
                      alt={user.profilePicture.alt || displayName}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className={`w-8 h-8 rounded-full ${avatarBgColor} flex items-center justify-center`}>
                    <span className="text-sm font-medium text-white">{initials}</span>
                  </div>
                )}
              </button>

              {isProfileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#171717] rounded-lg shadow-lg border border-gray-200 dark:border-[#262626] py-1 z-50">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-[#262626]">
                    {user?.profilePicture?.url ? (
                      <img
                        src={user.profilePicture.url}
                        alt={user.profilePicture.alt || displayName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className={`w-10 h-10 rounded-full ${avatarBgColor} flex items-center justify-center flex-shrink-0`}>
                        <span className="text-sm font-medium text-white">{initials}</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{displayName}</p>
                      <p className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate">{user?.email ?? ''}</p>
                    </div>
                  </div>
                  <Link
                    href="/profile"
                    onClick={() => setIsProfileDropdownOpen(false)}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-100 dark:hover:bg-[#262626]"
                  >
                    <User className="w-4 h-4 mr-3 text-gray-400" />
                    Your Profile
                  </Link>
                  <Link
                    href="/settings/configuration"
                    onClick={() => setIsProfileDropdownOpen(false)}
                    className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-100 dark:hover:bg-[#262626]"
                  >
                    <Settings className="w-4 h-4 mr-3 text-gray-400" />
                    Configuration
                  </Link>
                  <div className="border-t border-gray-100 dark:border-[#262626] mt-1 pt-1">
                    <LogoutButton />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Search - Full-screen modal (portal-based) */}
      <SearchModal
        isOpen={isMobileSearchOpen}
        onClose={() => setIsMobileSearchOpen(false)}
      />
    </>
  );
}
