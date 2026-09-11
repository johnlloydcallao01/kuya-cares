'use client';

import React from 'react';
import type { OutletStatus } from '@/lib/dashboard-types';
import { Store, Clock, ShoppingCart } from '@/components/ui/IconWrapper';

interface OutletStatusGridProps {
  outlets: OutletStatus[];
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; darkBg: string }> = {
  open: { label: 'Open', dot: 'bg-green-500', bg: 'bg-green-50', darkBg: 'dark:bg-green-900/20' },
  closed: { label: 'Closed', dot: 'bg-red-500', bg: 'bg-red-50', darkBg: 'dark:bg-red-900/20' },
  busy: { label: 'Busy', dot: 'bg-amber-500', bg: 'bg-amber-50', darkBg: 'dark:bg-amber-900/20' },
  temp_closed: { label: 'Temp Closed', dot: 'bg-orange-500', bg: 'bg-orange-50', darkBg: 'dark:bg-orange-900/20' },
  maintenance: { label: 'Maintenance', dot: 'bg-gray-500', bg: 'bg-gray-50', darkBg: 'dark:bg-[#262626]' },
};

export function OutletStatusGrid({ outlets }: OutletStatusGridProps) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">My Outlets</h3>
      {outlets.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-[#a1a1aa] text-center py-8">No outlets found</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {outlets.map((outlet) => {
            const config = STATUS_CONFIG[outlet.operationalStatus] || STATUS_CONFIG.closed;
            return (
              <div
                key={outlet.id}
                className={`rounded-lg border border-gray-200 dark:border-[#262626] p-4 hover:shadow-md transition-shadow ${config.bg} ${config.darkBg}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <Store className="w-4 h-4 text-gray-600 dark:text-[#a1a1aa]" />
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{outlet.name}</p>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                  <span className="text-xs font-medium text-gray-700 dark:text-[#a1a1aa]">{config.label}</span>
                  {!outlet.isAcceptingOrders && (
                    <span className="text-xs text-red-600 dark:text-red-400 ml-auto">Not Accepting</span>
                  )}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#a1a1aa]">
                  <span className="flex items-center gap-1">
                    <ShoppingCart className="w-3 h-3" />
                    {outlet.todayOrders} orders today
                  </span>
                  <span className="font-medium text-gray-700 dark:text-white">₱{outlet.todayRevenue.toLocaleString()}</span>
                </div>
                {outlet.avgDeliveryTime > 0 && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-500 dark:text-[#a1a1aa]">
                    <Clock className="w-3 h-3" />
                    ~{outlet.avgDeliveryTime} min avg delivery
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
