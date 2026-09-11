'use client';

import React from 'react';
import type { IconName } from '@/types';
import { getIcon } from '@/utils';
import { ChevronDown } from '@/components/ui/IconWrapper';

interface SidebarDropdownGroupProps {
  icon: IconName;
  label: string;
  isOpen: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  active: boolean;
  children: React.ReactNode;
  badge?: number;
}

export function SidebarDropdownGroup({
  icon,
  label,
  isOpen,
  isExpanded,
  onToggle,
  active,
  children,
  badge = 0,
}: SidebarDropdownGroupProps) {
  const baseClasses = 'flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors';
  const activeClasses = active
    ? 'bg-gray-100 dark:bg-[#262626] text-gray-900 dark:text-white'
    : 'text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-100 dark:hover:bg-[#262626] hover:text-gray-900 dark:hover:text-white';

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={onToggle}
        className={`${baseClasses} ${activeClasses} relative`}
        aria-expanded={isExpanded}
      >
        <div className="flex-shrink-0 relative">
          {getIcon(icon)}
          {!isOpen && badge > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </div>
        {!isOpen ? null : (
          <>
            <span className="ml-3 flex-1 truncate text-left">{label}</span>
            {badge > 0 && (
              <span className="mr-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white">
                {badge > 9 ? '9+' : badge}
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 text-gray-400 dark:text-[#a1a1aa] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
          </>
        )}
      </button>

      {isOpen && isExpanded ? <div className="ml-4 space-y-1 border-l border-gray-200 dark:border-[#262626] pl-3">{children}</div> : null}
    </div>
  );
}
