'use client';

import React from 'react';
import Link from 'next/link';
import { getIcon, IconName } from './icons';

interface SidebarItemProps {
  icon: IconName;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
  href?: string;
}

export function SidebarItem({ 
  icon, 
  label, 
  active = false, 
  collapsed = false, 
  onClick,
  href 
}: SidebarItemProps) {
  const baseClasses = "w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1";
  const activeClasses = active
    ? 'bg-blue-50 text-blue-700'
    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900';

  const content = (
    <>
      <div className={`flex-shrink-0 ${active ? 'text-blue-600' : 'text-gray-400'}`}>
        {getIcon(icon)}
      </div>
      {!collapsed && <span className="ml-3 truncate">{label}</span>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
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
