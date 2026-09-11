'use client';

import React from 'react';
import type { ActiveDelivery } from '@/lib/dashboard-types';
import Link from '@/components/ui/LinkWrapper';

interface ActiveDeliveriesListProps {
  deliveries: ActiveDelivery[];
}

const DELIVERY_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  assigning_driver: 'bg-amber-100 text-amber-800',
  driver_assigned: 'bg-blue-100 text-blue-800',
  picked_up: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  canceled: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
};

export function ActiveDeliveriesList({ deliveries }: ActiveDeliveriesListProps) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Active Deliveries</h3>
        {deliveries.length > 0 && (
          <Link href="/fulfillment/tracking" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
            Track all →
          </Link>
        )}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-[#262626]">
        {deliveries.map((delivery) => (
          <div key={delivery.orderId} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-900 dark:text-white">#{delivery.orderId}</span>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${
                DELIVERY_STATUS_STYLES[delivery.status] || 'bg-gray-100 text-gray-800'
              }`}>
                {delivery.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate mb-1">{delivery.outletName}</p>
            <p className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate">{delivery.customerAddress}</p>
            {delivery.driverName && (
              <p className="text-xs text-gray-400 dark:text-[#a1a1aa] mt-1">Driver: {delivery.driverName}</p>
            )}
          </div>
        ))}
        {deliveries.length === 0 && (
          <div className="px-6 py-8 text-center text-sm text-gray-400 dark:text-[#a1a1aa]">
            No active deliveries
          </div>
        )}
      </div>
    </div>
  );
}
