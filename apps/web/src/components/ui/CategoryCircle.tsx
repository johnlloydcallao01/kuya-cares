import React from 'react';
import { CategoryCircleProps, CategoryName } from '@/types';
import { getCategoryIcon } from '@/utils';

/**
 * CategoryCircle component for category selection
 * 
 * @param label - The category label
 * @param active - Whether the category is currently active/selected
 * @param onClick - Optional click handler
 */
export function CategoryCircle({ 
  label, 
  active = false, 
  onClick 
}: CategoryCircleProps) {
  const categoryConfig = getCategoryIcon(label as CategoryName);
  
  return (
    <div 
      className="flex flex-col items-center space-y-2 cursor-pointer group"
      onClick={onClick}
    >
      <div 
        className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
          active 
            ? `${categoryConfig.bgColor} scale-110 shadow-lg` 
            : `${categoryConfig.bgColor} opacity-70 group-hover:opacity-100 group-hover:scale-105`
        }`}
      >
        {categoryConfig.icon}
      </div>
      <span 
        className={`text-xs font-medium transition-colors ${
          active 
            ? 'text-gray-900' 
            : 'text-gray-600 group-hover:text-gray-900'
        }`}
      >
        {label}
      </span>
    </div>
  );
}
