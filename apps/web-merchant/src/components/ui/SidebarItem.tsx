import React from 'react';
import Link from '@/components/ui/LinkWrapper';
import type { Route } from 'next';
import { SidebarItemProps, IconName } from '@/types';
import { getIcon } from '@/utils';

/**
 * SidebarItem component for navigation items in the admin sidebar
 * 
 * @param icon - The icon name to display
 * @param label - The text label for the item
 * @param active - Whether the item is currently active/selected
 * @param collapsed - Whether the sidebar is in collapsed state
 * @param onClick - Optional click handler
 * @param href - Optional href for navigation
 */
export function SidebarItem({ 
  icon, 
  label, 
  active = false, 
  collapsed = false, 
  onClick,
  href,
  badge = 0
}: SidebarItemProps & { badge?: number }) {
  const baseClasses = "relative w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors";
  const activeClasses = active
    ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100'
    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100';

  const content = (
    <>
      <div className="flex-shrink-0">
        {getIcon(icon as IconName)}
      </div>
      {!collapsed && <span className="ml-3 truncate">{label}</span>}
      {badge > 0 && (
        <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white leading-none ${collapsed ? "absolute -right-1 -top-1" : "ml-auto"}`}>
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href as Route}
        className={`${baseClasses} ${activeClasses}`}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      className={`${baseClasses} ${activeClasses}`}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
