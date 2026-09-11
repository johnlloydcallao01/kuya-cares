import React from 'react';
import Link from 'next/link';
import { SidebarItemProps, IconName } from '@/types';
import { getIcon } from '@/utils';

/**
 * SidebarItem component for navigation items in the sidebar
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
  href 
}: SidebarItemProps) {
  const baseClasses = "w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors";
  const activeClasses = active
    ? 'bg-gray-100 text-gray-900'
    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900';

  const content = (
    <>
      <div className="flex-shrink-0">
        {getIcon(icon as IconName)}
      </div>
      {!collapsed && <span className="ml-3 truncate">{label}</span>}
    </>
  );

  if (href) {
    const LinkComponent = Link as any;
    return (
      <LinkComponent
        href={href}
        className={`${baseClasses} ${activeClasses}`}
        onClick={onClick}
      >
        {content}
      </LinkComponent>
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
