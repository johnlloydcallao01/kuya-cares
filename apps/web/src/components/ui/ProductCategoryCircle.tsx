import React from 'react';
import type { ProductCategory } from '@/server';

// Component props interface
interface ProductCategoryCircleProps {
  category: ProductCategory;
  active?: boolean;
  onClick?: () => void;
}

/**
 * ProductCategoryCircle component for product category selection with dynamic images
 * 
 * @param category - The category object with name and icon data
 * @param active - Whether the category is currently active/selected
 * @param onClick - Optional click handler
 */
export function ProductCategoryCircle({ 
  category, 
  active = false, 
  onClick 
}: ProductCategoryCircleProps) {
  
  return (
    <div 
      className="flex flex-col items-center space-y-2 cursor-pointer group"
      onClick={onClick}
    >
      <div 
        className={`w-16 h-16 min-[1500px]:w-20 min-[1500px]:h-20 rounded-full flex items-center justify-center transition-all duration-200 overflow-hidden bg-gray-100 relative ${
          active 
            ? 'scale-110 shadow-lg' 
            : 'group-hover:scale-105'
        }`}
      >
        {category.media?.icon && (category.media.icon.cloudinaryURL || category.media.icon.url) ? (
           
          <img
             src={category.media.icon.cloudinaryURL || category.media.icon.url}
             alt={category.media.icon.alt || category.name}
             className="absolute inset-0 w-full h-full object-cover rounded-full"
           />
        ) : (
          <div className="w-8 h-8 min-[1500px]:w-10 min-[1500px]:h-10 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-gray-600 text-xs font-medium">
              {category.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      <span 
        className={`w-16 min-[1500px]:w-20 text-xs min-[1500px]:text-sm font-medium transition-colors text-center leading-tight ${
          active 
            ? 'text-gray-900' 
            : 'text-gray-600 group-hover:text-gray-900'
        }`}
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          wordBreak: 'break-word',
          hyphens: 'auto'
        }}
      >
        {category.name}
      </span>
    </div>
  );
}
