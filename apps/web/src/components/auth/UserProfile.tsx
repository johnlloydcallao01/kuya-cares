/**
 * @file apps/web/src/components/auth/UserProfile.tsx
 * @description User profile components for displaying user information and logout
 */

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useUser, useLogout } from '@/hooks/useAuth';

// ========================================
// USER AVATAR IMAGE COMPONENT
// ========================================

interface UserAvatarImageProps {
  src: string;
  alt: string;
  size: 'sm' | 'md' | 'lg' | 'xl';
  initials: string;
  sizeClasses: Record<string, string>;
}

function UserAvatarImage({ src, alt, size, initials, sizeClasses }: UserAvatarImageProps) {
  const [imageError, setImageError] = useState(false);
  
  const sizeMap = {
    sm: { width: 32, height: 32 },
    md: { width: 40, height: 40 },
    lg: { width: 48, height: 48 },
    xl: { width: 64, height: 64 }
  };
  
  if (imageError) {
    return (
      <div className={`${sizeClasses[size]} bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold`}>
        {initials}
      </div>
    );
  }
  
  return (
    <div className={`${sizeClasses[size]} rounded-full overflow-hidden border-2 border-white shadow-sm`}>
      {React.createElement(Image, {
        src,
        alt,
        width: sizeMap[size].width,
        height: sizeMap[size].height,
        className: "w-full h-full object-cover",
        onError: () => setImageError(true)
      })}
    </div>
  );
}

// ========================================
// USER AVATAR COMPONENT
// ========================================

interface UserAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showOnlineStatus?: boolean;
}

export function UserAvatar({ 
  size = 'md', 
  className = '',
  showOnlineStatus = false 
}: UserAvatarProps) {
  const { user, displayName, initials } = useUser();

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl'
  };

  const statusSize = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-3 h-3',
    xl: 'w-4 h-4'
  };

  // Get profile picture URL with fallback priority
  const getProfilePictureUrl = () => {
    if (!user?.profilePicture) return null;
    return user.profilePicture.cloudinaryURL || user.profilePicture.url || null;
  };

  const profilePictureUrl = getProfilePictureUrl();

  if (!user) {
    return (
      <div className={`${sizeClasses[size]} bg-gray-300 rounded-full flex items-center justify-center ${className}`}>
        <i className="fa fa-user text-gray-500"></i>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {profilePictureUrl ? (
        <UserAvatarImage 
          src={profilePictureUrl}
          alt={user.profilePicture?.alt || `${displayName}'s profile picture`}
          size={size}
          initials={initials}
          sizeClasses={sizeClasses}
        />
      ) : (
        // Fallback to gradient circle with initials
        <div className={`${sizeClasses[size]} bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-semibold`}>
          {initials}
        </div>
      )}
      
      {showOnlineStatus && (
        <div className={`absolute -bottom-0 -right-0 ${statusSize[size]} bg-green-400 border-2 border-white rounded-full`}></div>
      )}
    </div>
  );
}

// ========================================
// USER INFO COMPONENT
// ========================================

interface UserInfoProps {
  showEmail?: boolean;
  showRole?: boolean;
  className?: string;
}

export function UserInfo({ 
  showEmail = true, 
  showRole = false,
  className = '' 
}: UserInfoProps) {
  const { user, displayName } = useUser();

  if (!user) {
    return null;
  }

  return (
    <div className={`${className}`}>
      <div className="font-medium text-gray-900">{displayName}</div>
      {showEmail && (
        <div className="text-sm text-gray-500">{user.email}</div>
      )}
      {showRole && user.role && (
        <div className="text-xs text-blue-600 capitalize">{user.role}</div>
      )}
    </div>
  );
}

// ========================================
// LOGOUT BUTTON COMPONENT
// ========================================

interface LogoutButtonProps {
  variant?: 'button' | 'link' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  onLogoutStart?: () => void;
  onLogoutComplete?: () => void;
}

export function LogoutButton({ 
  variant = 'button',
  size = 'md',
  className = '',
  onLogoutStart,
  onLogoutComplete
}: LogoutButtonProps) {
  const { logout, isLoggingOut } = useLogout();

  const handleLogout = async () => {
    try {
      onLogoutStart?.();
      await logout();
      onLogoutComplete?.();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className={`p-2 text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50 ${className}`}
        title="Logout"
      >
        {isLoggingOut ? (
          <i className="fa fa-spinner fa-spin"></i>
        ) : (
          <i className="fa fa-sign-out-alt"></i>
        )}
      </button>
    );
  }

  if (variant === 'link') {
    return (
      <button
        onClick={handleLogout}
        disabled={isLoggingOut}
        className={`text-red-600 hover:text-red-700 transition-colors disabled:opacity-50 ${className}`}
      >
        {isLoggingOut ? (
          <>
            <i className="fa fa-spinner fa-spin mr-1"></i>
            Signing out...
          </>
        ) : (
          <>
            <i className="fa fa-sign-out-alt mr-1"></i>
            Sign out
          </>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className={`${sizeClasses[size]} bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isLoggingOut ? (
        <>
          <i className="fa fa-spinner fa-spin mr-2"></i>
          Signing out...
        </>
      ) : (
        <>
          <i className="fa fa-sign-out-alt mr-2"></i>
          Sign out
        </>
      )}
    </button>
  );
}

// ========================================
// USER DROPDOWN COMPONENT
// ========================================

interface UserDropdownProps {
  className?: string;
}

export function UserDropdown({ className = '' }: UserDropdownProps) {
  const { user, displayName } = useUser();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) {
    return null;
  }

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <UserAvatar size="md" showOnlineStatus />
        <div className="text-left">
          <div className="font-medium text-gray-900">{displayName}</div>
          <div className="text-sm text-gray-500">{user.email}</div>
        </div>
        <i className={`fa fa-chevron-down text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          ></div>
          
          {/* Dropdown Menu */}
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <UserAvatar size="lg" />
                <div>
                  <div className="font-medium text-gray-900">{displayName}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                  {user.role && (
                    <div className="text-xs text-blue-600 capitalize mt-1">{user.role}</div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-2">
              <button className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors">
                <i className="fa fa-user mr-3 text-gray-400"></i>
                Profile Settings
              </button>
              <button className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors">
                <i className="fa fa-cog mr-3 text-gray-400"></i>
                Account Settings
              </button>
              <button className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 transition-colors">
                <i className="fa fa-bell mr-3 text-gray-400"></i>
                Notifications
              </button>
            </div>
            
            <div className="p-2 border-t border-gray-200">
              <LogoutButton 
                variant="link" 
                className="w-full text-left px-3 py-2 rounded-md hover:bg-red-50"
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ========================================
// COMPACT USER PROFILE
// ========================================

interface CompactUserProfileProps {
  className?: string;
  showLogout?: boolean;
}

export function CompactUserProfile({ 
  className = '',
  showLogout = true 
}: CompactUserProfileProps) {
  const { user, displayName } = useUser();

  if (!user) {
    return null;
  }

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="flex items-center space-x-3">
        <UserAvatar size="md" showOnlineStatus />
        <UserInfo showEmail={false} />
      </div>
      
      {showLogout && (
        <LogoutButton variant="icon" />
      )}
    </div>
  );
}

// ========================================
// EXPORTS
// ========================================

export default UserDropdown;
