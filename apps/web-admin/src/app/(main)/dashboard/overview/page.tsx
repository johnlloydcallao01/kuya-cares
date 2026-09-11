'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@encreasl/client-services';
import { useDashboard } from '@/hooks/useDashboard';
import { ClientOnly } from '@/components/ClientOnly';
import {
  MetricCard,
  RevenueChart,
  OrderStatusChart,
  TopMerchantsChart,
  RecentOrdersTable,
  TopVendorsTable,
} from '@/components/dashboard';
import { DollarSign, ShoppingCart, Store, RefreshCw, AlertCircle } from '@/components/ui/IconWrapper';

function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center min-h-[500px]">
      <div className="text-center max-w-md">
        <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-7 w-7 text-red-500 dark:text-red-400" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Failed to load dashboard</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{message}</p>
        <button
          onClick={onRetry}
          className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </button>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5 animate-pulse">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2 min-w-0">
          <div className="h-7 bg-gray-100 dark:bg-gray-800 rounded w-36" />
          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-56 max-w-[65vw] sm:w-56" />
        </div>
        <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded w-32 hidden sm:block flex-shrink-0" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 [&>:last-child:nth-child(odd)]:col-span-full md:[&>:last-child:nth-child(odd)]:col-span-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-[var(--card-background)] rounded-xl border border-gray-200 dark:border-[var(--card-border)] p-5 shadow-sm">
            <div className="space-y-3">
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-20" />
              <div className="h-7 bg-gray-100 dark:bg-gray-800 rounded w-12" />
              <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-24" />
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-[var(--card-background)] rounded-xl border border-gray-200 dark:border-[var(--card-border)] shadow-sm p-4 h-64 sm:h-80">
          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-36 mb-4" />
          <div className="flex items-end gap-2 sm:gap-3 h-48 sm:h-64">
            {[55, 70, 40, 85, 50, 65, 45, 75].map((h, i) => (
              <div key={i} className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-t" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-[var(--card-background)] rounded-xl border border-gray-200 dark:border-[var(--card-border)] shadow-sm p-4 h-64 sm:h-80">
          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-36 mb-4" />
          <div className="flex items-center justify-center h-48 sm:h-64">
            <div className="relative h-32 w-32 sm:h-40 sm:w-40">
              <div className="h-full w-full rounded-full bg-gray-100 dark:bg-gray-800" />
              <div className="absolute inset-4 sm:inset-5 rounded-full bg-white dark:bg-[var(--card-background)]" />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-[var(--card-background)] rounded-xl border border-gray-200 dark:border-[var(--card-border)] shadow-sm p-4 h-64 sm:h-80">
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-36 mb-4" />
        <div className="flex items-end gap-2 sm:gap-3 h-48 sm:h-64">
          {[40, 60, 45, 75, 55].map((h, i) => (
            <div key={i} className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-t" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-[var(--card-background)] rounded-xl border border-gray-200 dark:border-[var(--card-border)] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-[var(--card-border)]">
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-32" />
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-[var(--card-background)] rounded-xl border border-gray-200 dark:border-[var(--card-border)] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-[var(--card-border)]">
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-28" />
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded flex-1" />
                </div>
                <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardPageContent() {
  const queryClient = useQueryClient();
  const [hardRefreshing, setHardRefreshing] = useState(false);
  const { data, isLoading, isFetching, isError, error, refetch } = useDashboard();
  const errorMessage = isError && !data && !hardRefreshing ? (error instanceof Error ? error.message : 'Failed to load dashboard') : null;

  const handleHardRefresh = () => {
    if (hardRefreshing) return;
    setHardRefreshing(true);
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.adminDashboard });
        await refetch({ cancelRefetch: true });
      } finally {
        setHardRefreshing(false);
      }
    })();
  };

  if (isError && !data && !hardRefreshing) {
    return (
      <div className="p-4 sm:p-6">
        <DashboardError message={errorMessage ?? 'Failed to load dashboard'} onRetry={handleHardRefresh} />
      </div>
    );
  }

  // Skeleton on first load or during explicit hard refresh.
  // Back-nav within 3-min staleTime hits TanStack cache -> instant render, no skeleton.
  if ((isLoading && !data) || hardRefreshing) {
    return <DashboardSkeleton />;
  }

  if (!data) return null;

  const { metrics, revenueChart, orderStatusChart, topMerchants, topVendors, recentOrders } = data;

  return (
    <div className="space-y-6 py-5 px-2.5">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
            Overview of your platform performance
            {isFetching && data && !hardRefreshing ? <span className="ml-2 text-xs text-gray-400">Updating…</span> : null}
          </p>
        </div>
        <button
          onClick={handleHardRefresh}
          disabled={isFetching || hardRefreshing}
          title="Refresh fresh data"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-[#171717] border border-gray-200 dark:border-[#262626] rounded-full hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-[#a1a1aa] ${isFetching || hardRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 [&>:last-child:nth-child(odd)]:col-span-full md:[&>:last-child:nth-child(odd)]:col-span-1">
        <MetricCard
          title="Total Revenue"
          value={`₱${metrics.totalRevenue.toLocaleString()}`}
          change={metrics.revenueChange}
          icon={<DollarSign className="w-5 h-5 text-white" />}
          iconBg="bg-green-500"
        />
        <MetricCard
          title="Total Orders"
          value={metrics.totalOrders.toLocaleString()}
          change={metrics.ordersChange}
          icon={<ShoppingCart className="w-5 h-5 text-white" />}
          iconBg="bg-blue-500"
        />
        <MetricCard
          title="Active Merchants"
          value={metrics.activeMerchants.toLocaleString()}
          change={metrics.merchantsChange}
          icon={<Store className="w-5 h-5 text-white" />}
          iconBg="bg-purple-500"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <RevenueChart data={revenueChart} />
        <OrderStatusChart data={orderStatusChart} />
      </div>

      {/* Top Merchants Chart */}
      <TopMerchantsChart data={topMerchants} />

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2">
          <RecentOrdersTable orders={recentOrders} />
        </div>
        <div>
          <TopVendorsTable vendors={topVendors} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage(){
  // Pure CSR: charts (echarts canvas), toLocaleString totals, and order dates
  // only render post-mount → identical skeleton on server + hydration → no #441.
  return (
    <ClientOnly fallback={<DashboardSkeleton />}>
      <DashboardPageContent />
    </ClientOnly>
  );
}
