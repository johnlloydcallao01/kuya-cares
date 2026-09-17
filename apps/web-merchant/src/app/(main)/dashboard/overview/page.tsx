'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@encreasl/client-services';
import { useMerchantDashboardMetrics, useMerchantDashboardCharts, useMerchantDashboardTables } from '@/hooks/useMerchantDashboard';
import { ClientOnly } from '@/components/ClientOnly';
import {
  MetricCard,
  RevenueChart,
  OrderStatusChart,
  OutletStatusGrid,
  TopProductsChart,
  PendingOrdersTable,
  ActiveDeliveriesList,
  RecentOrdersTable,
} from '@/components/dashboard';
import { DollarSign, ShoppingCart, Clock, RefreshCw, AlertCircle } from '@/components/ui/IconWrapper';

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

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-900/40 shadow-sm p-6 text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{message}</p>
      <button
        onClick={onRetry}
        className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm"
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Retry
      </button>
    </div>
  );
}

function SectionSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-4 animate-pulse ${className}`}>
      <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-36 mb-4" />
      <div className="h-32 bg-gray-100 dark:bg-gray-700 rounded" />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5 animate-pulse">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2 min-w-0">
          <div className="h-7 bg-gray-100 dark:bg-gray-800 rounded w-56 max-w-[70vw]" />
          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-72 max-w-[80vw] sm:w-72" />
        </div>
        <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded w-32 hidden sm:block flex-shrink-0" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
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
      <div className="bg-white dark:bg-[var(--card-background)] rounded-xl border border-gray-200 dark:border-[var(--card-border)] shadow-sm p-4 h-auto sm:h-44">
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-36 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-gray-200 dark:border-[var(--card-border)] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="h-4 w-28 bg-gray-100 dark:bg-gray-800 rounded" />
                <div className="h-2 w-2 bg-gray-100 dark:bg-gray-800 rounded-full flex-shrink-0" />
              </div>
              <div className="flex gap-4">
                <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
                <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-[var(--card-background)] rounded-xl border border-gray-200 dark:border-[var(--card-border)] shadow-sm p-4 h-64 sm:h-80">
          <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-32 mb-4" />
          <div className="flex items-end gap-2 sm:gap-3 h-48 sm:h-64">
            {[40, 60, 35, 75, 50].map((h, i) => (
              <div key={i} className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-t" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-[var(--card-background)] rounded-xl border border-gray-200 dark:border-[var(--card-border)] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-[var(--card-border)]">
            <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-36" />
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0" />
                <div className="flex-1 space-y-1.5 min-w-0">
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-[var(--card-background)] rounded-xl border border-gray-200 dark:border-[var(--card-border)] shadow-sm overflow-hidden">
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
      </div>
    </div>
  );
}

function DashboardPageContent() {
  const queryClient = useQueryClient();
  const [hardRefreshing, setHardRefreshing] = useState(false);
  // Three independent queries under the same merchant-dashboard/ directory —
  // they fetch in parallel and each widget renders as soon as its own group
  // resolves (no whole-page waterfall).
  const metricsQuery = useMerchantDashboardMetrics();
  const chartsQuery = useMerchantDashboardCharts();
  const tablesQuery = useMerchantDashboardTables();

  const isFetching = metricsQuery.isFetching || chartsQuery.isFetching || tablesQuery.isFetching;
  const loading = isFetching || hardRefreshing;
  const allLoading =
    (metricsQuery.isLoading && !metricsQuery.data) &&
    (chartsQuery.isLoading && !chartsQuery.data) &&
    (tablesQuery.isLoading && !tablesQuery.data);
  const allErrored =
    metricsQuery.isError && !metricsQuery.data &&
    chartsQuery.isError && !chartsQuery.data &&
    tablesQuery.isError && !tablesQuery.data;

  const handleHardRefresh = () => {
    if (hardRefreshing) return;
    setHardRefreshing(true);
    void (async () => {
      try {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.merchantDashboardMetrics });
        queryClient.removeQueries({ queryKey: QUERY_KEYS.merchantDashboardCharts });
        queryClient.removeQueries({ queryKey: QUERY_KEYS.merchantDashboardTables });
        queryClient.removeQueries({ queryKey: QUERY_KEYS.merchantDashboard() });
        await Promise.all([
          metricsQuery.refetch({ cancelRefetch: true }),
          chartsQuery.refetch({ cancelRefetch: true }),
          tablesQuery.refetch({ cancelRefetch: true }),
        ]);
      } finally { setHardRefreshing(false) }
    })();
  };

  if (allErrored && !hardRefreshing) {
    return (
      <div className="p-4 sm:p-6">
        <DashboardError message="Failed to load dashboard" onRetry={handleHardRefresh} />
      </div>
    );
  }

  // Full skeleton only on cold first load (all three pending) or hard refresh.
  // Back-nav within staleTime hits TanStack cache -> instant render, no skeleton.
  // Otherwise each section below renders/skeletons independently (progressive).
  if (allLoading || hardRefreshing) {
    return <DashboardSkeleton />;
  }

  const metrics = metricsQuery.data?.metrics;
  const outlets = metricsQuery.data?.outlets;
  const revenueChart = chartsQuery.data?.revenueChart;
  const orderStatusChart = chartsQuery.data?.orderStatusChart;
  const topProducts = chartsQuery.data?.topProducts;
  const activeDeliveries = tablesQuery.data?.activeDeliveries;
  const pendingOrders = tablesQuery.data?.pendingOrders;
  const recentOrders = tablesQuery.data?.recentOrders;

  return (
    <div className="space-y-6 py-5 px-2.5">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">My Business Overview</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">Performance across all your outlets</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleHardRefresh}
            disabled={loading}
            aria-label="Refresh dashboard"
            title="Refresh — re-fetch from BFF and show skeleton"
            className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-300 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metric Cards + Outlets (metrics group) */}
      {metrics && outlets ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard
              title="Today's Revenue"
              value={`₱${metrics.todayRevenue.toLocaleString('en-PH')}`}
              change={metrics.revenueChange}
              icon={<DollarSign className="w-5 h-5 text-white" />}
              iconBg="bg-green-500"
            />
            <MetricCard
              title="Pending Orders"
              value={metrics.pendingOrders.toLocaleString('en-PH')}
              change={0}
              icon={<Clock className="w-5 h-5 text-white" />}
              iconBg="bg-amber-500"
            />
            <MetricCard
              title="Total Orders"
              value={metrics.totalOrders.toLocaleString('en-PH')}
              change={metrics.ordersChange}
              icon={<ShoppingCart className="w-5 h-5 text-white" />}
              iconBg="bg-blue-500"
            />
            <MetricCard
              title="Total Revenue"
              value={`₱${metrics.totalRevenue.toLocaleString('en-PH')}`}
              change={metrics.revenueChange}
              icon={<DollarSign className="w-5 h-5 text-white" />}
              iconBg="bg-purple-500"
            />
          </div>

          {/* Outlets Status */}
          <OutletStatusGrid outlets={outlets} />
        </>
      ) : metricsQuery.isError ? (
        <SectionError
          message={metricsQuery.error instanceof Error ? metricsQuery.error.message : 'Failed to load metrics'}
          onRetry={() => void metricsQuery.refetch({ cancelRefetch: true })}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm animate-pulse">
                <div className="space-y-3">
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-20" />
                  <div className="h-7 bg-gray-100 dark:bg-gray-700 rounded w-12" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded w-24" />
                </div>
              </div>
            ))}
          </div>
          <SectionSkeleton />
        </>
      )}

      {/* Charts Row (charts group) */}
      {revenueChart && orderStatusChart ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <RevenueChart data={revenueChart} />
          <OrderStatusChart data={orderStatusChart} />
        </div>
      ) : chartsQuery.isError ? (
        <SectionError
          message={chartsQuery.error instanceof Error ? chartsQuery.error.message : 'Failed to load charts'}
          onRetry={() => void chartsQuery.refetch({ cancelRefetch: true })}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <SectionSkeleton className="h-64 sm:h-80" />
          <SectionSkeleton className="h-64 sm:h-80" />
        </div>
      )}

      {/* Top Products (charts) & Active Deliveries (tables) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {topProducts ? (
          <TopProductsChart data={topProducts} />
        ) : chartsQuery.isError ? (
          <SectionError
            message={chartsQuery.error instanceof Error ? chartsQuery.error.message : 'Failed to load top products'}
            onRetry={() => void chartsQuery.refetch({ cancelRefetch: true })}
          />
        ) : (
          <SectionSkeleton />
        )}
        {activeDeliveries ? (
          <ActiveDeliveriesList deliveries={activeDeliveries} />
        ) : tablesQuery.isError ? (
          <SectionError
            message={tablesQuery.error instanceof Error ? tablesQuery.error.message : 'Failed to load deliveries'}
            onRetry={() => void tablesQuery.refetch({ cancelRefetch: true })}
          />
        ) : (
          <SectionSkeleton />
        )}
      </div>

      {/* Pending Orders & Recent Orders (tables group) */}
      {pendingOrders && recentOrders ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <PendingOrdersTable orders={pendingOrders} />
          <RecentOrdersTable orders={recentOrders} />
        </div>
      ) : tablesQuery.isError ? (
        <SectionError
          message={tablesQuery.error instanceof Error ? tablesQuery.error.message : 'Failed to load orders'}
          onRetry={() => void tablesQuery.refetch({ cancelRefetch: true })}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <SectionSkeleton />
          <SectionSkeleton />
        </div>
      )}
    </div>
  );
}

export default function DashboardPage(){
  // Pure CSR: locale-sensitive totals, TZ-sensitive dates, new-Date()
  // relative times, and echarts canvas only render post-mount → no #441.
  return (
    <ClientOnly fallback={<DashboardSkeleton />}>
      <DashboardPageContent />
    </ClientOnly>
  );
}
