'use client';

import React from 'react';
import type { PendingOrder } from '@/lib/dashboard-types';
import Link from '@/components/ui/LinkWrapper';

interface PendingOrdersTableProps {
  orders: PendingOrder[];
}

export function PendingOrdersTable({ orders }: PendingOrdersTableProps) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pending Orders</h3>
        {orders.length > 0 && (
          <Link href="/orders/pending" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
            View all →
          </Link>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-[#0a0a0a]">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Order</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Outlet</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Items</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Placed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
            {orders.map((order) => {
              const timeAgo = getTimeAgo(order.placedAt);
              return (
                <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors">
                  <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">#{order.id}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 dark:text-[#a1a1aa] truncate max-w-[120px]">{order.outletName}</td>
                  <td className="px-6 py-3 text-sm text-gray-600 dark:text-[#a1a1aa]">{order.itemCount}</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">₱{order.total.toLocaleString()}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${
                      order.fulfillmentType === 'delivery'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {order.fulfillmentType}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-500 dark:text-[#a1a1aa]">{timeAgo}</td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400 dark:text-[#a1a1aa]">
                  No pending orders
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  if (!dateStr) return '—';
  const now = new Date();
  const then = new Date(dateStr);
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}
