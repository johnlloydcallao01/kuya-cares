'use client';

import React from 'react';
import type { TopVendor } from '@/lib/dashboard-types';
import { Star, Store, ShoppingCart } from '@/components/ui/IconWrapper';

interface TopVendorsTableProps {
  vendors: TopVendor[];
}

export function TopVendorsTable({ vendors }: TopVendorsTableProps) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-[#262626]">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Top Vendors</h3>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-[#262626]">
        {vendors.map((vendor, i) => (
          <div key={vendor.id} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{i + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{vendor.businessName}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-[#a1a1aa]">
                    <ShoppingCart className="w-3 h-3" />
                    {vendor.totalOrders} orders
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-[#a1a1aa]">
                    <Store className="w-3 h-3" />
                    {vendor.totalMerchants} merchants
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-[#a1a1aa]">
                  {vendor.averageRating > 0 ? vendor.averageRating.toFixed(1) : '—'}
                </span>
              </div>
            </div>
          </div>
        ))}
        {vendors.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-gray-400 dark:text-[#a1a1aa]">No vendors found</div>
        )}
      </div>
    </div>
  );
}
