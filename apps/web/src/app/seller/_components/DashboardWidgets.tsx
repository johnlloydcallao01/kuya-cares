'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  Clock,
  ShoppingCart,
  Store,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type {
  ActiveDelivery,
  DailyRevenue,
  OrderStatusBreakdown,
  OutletStatus,
  PendingOrder,
  RecentOrder,
  TopProduct,
} from '../_lib/dashboard-types';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

export function MetricCard({
  title,
  value,
  change,
  icon,
  iconBg,
}: {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  iconBg: string;
}) {
  const isPositive = change >= 0;

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500 dark:text-[#a1a1aa] truncate">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
          <div className="flex items-center mt-2">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-green-500 dark:text-green-400 mr-1" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500 dark:text-red-400 mr-1" />
            )}
            <span className={`text-sm font-medium ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {isPositive ? '+' : ''}{change.toFixed(1)}%
            </span>
            <span className="text-xs text-gray-400 dark:text-[#a1a1aa] ml-1.5">vs last 30 days</span>
          </div>
        </div>
        <div className={`flex-shrink-0 p-3 rounded-xl ${iconBg}`}>{icon}</div>
      </div>
    </div>
  );
}

export function OutletStatusGrid({ outlets }: { outlets: OutletStatus[] }) {
  const statuses: Record<string, { label: string; dot: string; bg: string; darkBg: string }> = {
    open: { label: 'Open', dot: 'bg-green-500', bg: 'bg-green-50', darkBg: 'dark:bg-green-900/20' },
    closed: { label: 'Closed', dot: 'bg-red-500', bg: 'bg-red-50', darkBg: 'dark:bg-red-900/20' },
    busy: { label: 'Busy', dot: 'bg-amber-500', bg: 'bg-amber-50', darkBg: 'dark:bg-amber-900/20' },
    temp_closed: { label: 'Temp Closed', dot: 'bg-orange-500', bg: 'bg-orange-50', darkBg: 'dark:bg-orange-900/20' },
    maintenance: { label: 'Maintenance', dot: 'bg-gray-500', bg: 'bg-gray-50', darkBg: 'dark:bg-[#262626]' },
  };

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">My Outlets</h3>
      {outlets.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-[#a1a1aa] text-center py-8">No outlets found</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {outlets.map((outlet) => {
            const config = statuses[outlet.operationalStatus] || statuses.closed;
            return (
              <div key={outlet.id} className={`rounded-lg border border-gray-200 dark:border-[#262626] p-4 hover:shadow-md transition-shadow ${config.bg} ${config.darkBg}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Store className="w-4 h-4 text-gray-600 dark:text-[#a1a1aa]" />
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{outlet.name}</p>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                  <span className="text-xs font-medium text-gray-700 dark:text-[#a1a1aa]">{config.label}</span>
                  {!outlet.isAcceptingOrders && <span className="text-xs text-red-600 dark:text-red-400 ml-auto">Not Accepting</span>}
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#a1a1aa]">
                  <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3" />{outlet.todayOrders} orders today</span>
                  <span className="font-medium text-gray-700 dark:text-white">₱{outlet.todayRevenue.toLocaleString()}</span>
                </div>
                {outlet.avgDeliveryTime > 0 && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-500 dark:text-[#a1a1aa]">
                    <Clock className="w-3 h-3" />~{outlet.avgDeliveryTime} min avg delivery
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

export function RevenueChart({ data }: { data: DailyRevenue[] }) {
  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#171717',
      borderColor: '#262626',
      borderWidth: 1,
      textStyle: { color: '#ededed', fontSize: 12 },
      formatter: (params: Array<{ name: string; value: number; seriesName: string }>) => {
        const item = params[0];
        return `<div style="font-weight:600;margin-bottom:4px">${item.name}</div><div style="color:#a1a1aa">${item.seriesName}: <span style="font-weight:600;color:#ededed">₱${item.value.toLocaleString()}</span></div>`;
      },
    },
    grid: { top: 10, right: 10, bottom: 30, left: 50 },
    xAxis: {
      type: 'category' as const,
      data: data.map((item) => item.date),
      axisLine: { lineStyle: { color: '#262626' } },
      axisLabel: { color: '#a1a1aa', fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#262626' } },
      axisLabel: { color: '#a1a1aa', fontSize: 11, formatter: (value: number) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value) },
    },
    series: [{
      name: 'Revenue',
      type: 'line',
      data: data.map((item) => item.revenue),
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#2563eb', width: 2.5 },
      itemStyle: { color: '#2563eb' },
      areaStyle: {
        color: {
          type: 'linear' as const,
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(37, 99, 235, 0.15)' },
            { offset: 1, color: 'rgba(37, 99, 235, 0.01)' },
          ],
        },
      },
    }],
  }), [data]);

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Revenue (Last 30 Days)</h3>
      <ReactECharts option={option} style={{ height: 280 }} />
    </div>
  );
}

const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  accepted: '#3b82f6',
  preparing: '#8b5cf6',
  ready_for_pickup: '#06b6d4',
  on_delivery: '#10b981',
  delivered: '#22c55e',
  cancelled: '#ef4444',
};
const FALLBACK_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export function OrderStatusChart({ data }: { data: OrderStatusBreakdown[] }) {
  const option = useMemo(() => {
    const total = data.reduce((sum, item) => sum + item.count, 0);
    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#171717',
        borderColor: '#262626',
        borderWidth: 1,
        textStyle: { color: '#ededed', fontSize: 12 },
        formatter: (params: { name: string; value: number; percent: number }) =>
          `<div style="font-weight:600;margin-bottom:2px;text-transform:capitalize">${params.name.replace(/_/g, ' ')}</div><div style="color:#a1a1aa">${params.value} orders (${params.percent.toFixed(1)}%)</div>`,
      },
      legend: {
        orient: 'vertical' as const,
        right: 10,
        top: 'center',
        textStyle: { color: '#a1a1aa', fontSize: 12 },
        formatter: (name: string) => name.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase()),
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 12,
      },
      series: [{
        type: 'pie',
        radius: ['50%', '75%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'center' as const,
          formatter: () => `{total|${total}}\n{label|Orders}`,
          rich: {
            total: { fontSize: 24, fontWeight: 'bold' as const, color: '#ededed', lineHeight: 32 },
            label: { fontSize: 12, color: '#a1a1aa', lineHeight: 18 },
          },
        },
        emphasis: { label: { show: true }, itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.1)' } },
        data: data.map((item, index) => ({
          name: item.status,
          value: item.count,
          itemStyle: { color: ORDER_STATUS_COLORS[item.status] || FALLBACK_COLORS[index % FALLBACK_COLORS.length] },
        })),
      }],
    };
  }, [data]);

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Order Status</h3>
      <ReactECharts option={option} style={{ height: 280 }} />
    </div>
  );
}

export function TopProductsChart({ data }: { data: TopProduct[] }) {
  const option = useMemo(() => ({
    tooltip: { trigger: 'axis' as const, axisPointer: { type: 'shadow' as const }, backgroundColor: '#171717', borderColor: '#262626', borderWidth: 1, textStyle: { color: '#ededed', fontSize: 12 } },
    grid: { top: 10, right: 10, bottom: 10, left: 10, containLabel: true },
    xAxis: { type: 'value' as const, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: '#262626' } }, axisLabel: { color: '#a1a1aa', fontSize: 11 } },
    yAxis: { type: 'category' as const, data: data.map((item) => item.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#ededed', fontSize: 12, width: 120, overflow: 'truncate' as const }, inverse: true },
    series: [{
      type: 'bar',
      data: data.map((item) => item.totalSold),
      barWidth: 20,
      itemStyle: { color: { type: 'linear' as const, x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: '#10b981' }, { offset: 1, color: '#34d399' }] }, borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: 'right' as const, color: '#a1a1aa', fontSize: 11, formatter: '{c} sold' },
    }],
  }), [data]);

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Top Products</h3>
      <ReactECharts option={option} style={{ height: 280 }} />
    </div>
  );
}

const DELIVERY_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  assigning_driver: 'bg-amber-100 text-amber-800',
  driver_assigned: 'bg-blue-100 text-blue-800',
  picked_up: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  canceled: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-800',
};

export function ActiveDeliveriesList({ deliveries }: { deliveries: ActiveDelivery[] }) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Active Deliveries</h3>
        {deliveries.length > 0 && <Link href="/seller/orders" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">Track all →</Link>}
      </div>
      <div className="divide-y divide-gray-100 dark:divide-[#262626]">
        {deliveries.map((delivery) => (
          <div key={delivery.orderId} className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-900 dark:text-white">#{delivery.orderId}</span>
              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${DELIVERY_STYLES[delivery.status] || 'bg-gray-100 text-gray-800'}`}>{delivery.status.replace(/_/g, ' ')}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate mb-1">{delivery.outletName}</p>
            <p className="text-xs text-gray-500 dark:text-[#a1a1aa] truncate">{delivery.customerAddress}</p>
            {delivery.driverName && <p className="text-xs text-gray-400 dark:text-[#a1a1aa] mt-1">Driver: {delivery.driverName}</p>}
          </div>
        ))}
        {deliveries.length === 0 && <div className="px-6 py-8 text-center text-sm text-gray-400 dark:text-[#a1a1aa]">No active deliveries</div>}
      </div>
    </div>
  );
}

export function PendingOrdersTable({ orders }: { orders: PendingOrder[] }) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-[#262626] flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pending Orders</h3>
        {orders.length > 0 && <Link href="/seller/orders" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">View all →</Link>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="bg-gray-50 dark:bg-[#0a0a0a]">
            {['Order', 'Outlet', 'Items', 'Total', 'Type', 'Placed'].map((heading) => <th key={heading} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">{heading}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors">
                <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">#{order.id}</td>
                <td className="px-6 py-3 text-sm text-gray-600 dark:text-[#a1a1aa] truncate max-w-[120px]">{order.outletName}</td>
                <td className="px-6 py-3 text-sm text-gray-600 dark:text-[#a1a1aa]">{order.itemCount}</td>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">₱{order.total.toLocaleString()}</td>
                <td className="px-6 py-3"><span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${order.fulfillmentType === 'delivery' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>{order.fulfillmentType}</span></td>
                <td className="px-6 py-3 text-sm text-gray-500 dark:text-[#a1a1aa]">{timeAgo(order.placedAt)}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-gray-400 dark:text-[#a1a1aa]">No pending orders</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function timeAgo(date: string): string {
  if (!date) return '—';
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const ORDER_STYLES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  ready_for_pickup: 'bg-cyan-100 text-cyan-800',
  on_delivery: 'bg-teal-100 text-teal-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function RecentOrdersTable({ orders }: { orders: RecentOrder[] }) {
  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-[#262626]"><h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Orders</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="bg-gray-50 dark:bg-[#0a0a0a]">
            {['Order ID', 'Customer', 'Total', 'Status', 'Date'].map((heading) => <th key={heading} className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-[#a1a1aa] uppercase tracking-wider">{heading}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-[#262626] transition-colors">
                <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">#{order.id}</td>
                <td className="px-6 py-3 text-sm text-gray-600 dark:text-[#a1a1aa] truncate max-w-[180px]">{order.customerEmail}</td>
                <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">₱{order.total.toLocaleString('en-PH')}</td>
                <td className="px-6 py-3"><span className={`inline-flex px-2 py-1 text-xs font-medium capitalize rounded-full ${ORDER_STYLES[order.status] || 'bg-gray-100 text-gray-800'}`}>{order.status.replace(/_/g, ' ')}</span></td>
                <td className="px-6 py-3 text-sm text-gray-500 dark:text-[#a1a1aa]">{order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-400 dark:text-[#a1a1aa]">No orders found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
