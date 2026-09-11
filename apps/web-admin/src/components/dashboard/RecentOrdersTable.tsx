'use client';

import React from 'react';
import type { RecentOrder } from '@/lib/dashboard-types';

interface RecentOrdersTableProps {
  orders: RecentOrder[];
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  ready_for_pickup: 'bg-cyan-100 text-cyan-800',
  out_for_delivery: 'bg-teal-100 text-teal-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-gray-100 text-gray-800',
};

export function RecentOrdersTable({ orders }: RecentOrdersTableProps) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-[#262626]">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Orders</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-[#0a0a0a]">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Order ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Merchant</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors">
                <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">#{order.id}</td>
                <td className="px-6 py-3 text-sm text-gray-600 dark:text-[#a1a1aa] truncate max-w-[150px]">{order.merchantName}</td>
                <td className="px-6 py-3 text-sm text-gray-600 dark:text-[#a1a1aa] truncate max-w-[150px]">{order.customerEmail}</td>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">₱{order.total.toLocaleString()}</td>
                <td className="px-6 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${STATUS_STYLES[order.status] || 'bg-gray-100 text-gray-800'}`}>
                    {order.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-6 py-3 text-sm text-gray-500 dark:text-[#a1a1aa]">
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400 dark:text-[#a1a1aa]">No orders found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
