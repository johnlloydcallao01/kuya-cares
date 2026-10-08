'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Clock, DollarSign, RefreshCw, ShoppingCart } from 'lucide-react';
import {
  ActiveDeliveriesList,
  MetricCard,
  OrderStatusChart,
  OutletStatusGrid,
  PendingOrdersTable,
  RecentOrdersTable,
  RevenueChart,
  TopProductsChart,
} from '@/app/seller/_components/DashboardWidgets';
import {
  useSellerDashboardCharts,
  useSellerDashboardMetrics,
  useSellerDashboardTables,
} from '@/app/seller/_hooks/useSellerDashboard';

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
        <div className="h-9 w-9 bg-gray-100 dark:bg-gray-800 rounded-xl hidden sm:block" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }, (_, index) => <SectionSkeleton key={index} className="h-32" />)}
      </div>
      <SectionSkeleton className="h-44" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <SectionSkeleton className="h-80" />
        <SectionSkeleton className="h-80" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <SectionSkeleton className="h-80" />
        <SectionSkeleton className="h-80" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    </div>
  );
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-red-200 dark:border-red-900/40 shadow-sm p-6 text-center">
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{message}</p>
      <button onClick={onRetry} className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm">
        <RefreshCw className="h-4 w-4 mr-2" />Retry
      </button>
    </div>
  );
}

export default function SellerDashboardOverviewPage() {
  const queryClient = useQueryClient();
  const [hardRefreshing, setHardRefreshing] = useState(false);
  const metricsQuery = useSellerDashboardMetrics();
  const chartsQuery = useSellerDashboardCharts();
  const tablesQuery = useSellerDashboardTables();

  const loading = metricsQuery.isFetching || chartsQuery.isFetching || tablesQuery.isFetching || hardRefreshing;
  const allLoading =
    (metricsQuery.isLoading && !metricsQuery.data) &&
    (chartsQuery.isLoading && !chartsQuery.data) &&
    (tablesQuery.isLoading && !tablesQuery.data);
  const allErrored =
    metricsQuery.isError && !metricsQuery.data &&
    chartsQuery.isError && !chartsQuery.data &&
    tablesQuery.isError && !tablesQuery.data;

  const refresh = () => {
    if (hardRefreshing) return;
    setHardRefreshing(true);
    void (async () => {
      try {
        await Promise.all([
          queryClient.cancelQueries({ queryKey: ['seller', 'dashboard', 'v2', 'metrics'] }),
          queryClient.cancelQueries({ queryKey: ['seller', 'dashboard', 'v2', 'charts'] }),
          queryClient.cancelQueries({ queryKey: ['seller', 'dashboard', 'v2', 'tables'] }),
        ]);
        queryClient.removeQueries({ queryKey: ['seller', 'dashboard', 'v2', 'metrics'] });
        queryClient.removeQueries({ queryKey: ['seller', 'dashboard', 'v2', 'charts'] });
        queryClient.removeQueries({ queryKey: ['seller', 'dashboard', 'v2', 'tables'] });
        await Promise.all([
          metricsQuery.refetch({ cancelRefetch: true }),
          chartsQuery.refetch({ cancelRefetch: true }),
          tablesQuery.refetch({ cancelRefetch: true }),
        ]);
      } finally {
        setHardRefreshing(false);
      }
    })();
  };

  if (allErrored && !hardRefreshing) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="text-center max-w-md">
            <div className="h-14 w-14 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-7 w-7 text-red-500 dark:text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Failed to load dashboard</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Check your connection and try again.</p>
            <button onClick={refresh} className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm">
              <RefreshCw className="h-4 w-4 mr-2" />Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (allLoading || hardRefreshing) return <DashboardSkeleton />;

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">My Business Overview</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">Performance across all your outlets</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh dashboard"
          title="Refresh dashboard"
          className="h-9 w-9 inline-flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-300 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {metrics && outlets ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard title="Today's Revenue" value={`₱${metrics.todayRevenue.toLocaleString('en-PH')}`} change={metrics.revenueChange} icon={<DollarSign className="w-5 h-5 text-white" />} iconBg="bg-green-500" />
            <MetricCard title="Pending Orders" value={metrics.pendingOrders.toLocaleString('en-PH')} change={0} icon={<Clock className="w-5 h-5 text-white" />} iconBg="bg-amber-500" />
            <MetricCard title="Total Orders" value={metrics.totalOrders.toLocaleString('en-PH')} change={metrics.ordersChange} icon={<ShoppingCart className="w-5 h-5 text-white" />} iconBg="bg-blue-500" />
            <MetricCard title="Total Revenue" value={`₱${metrics.totalRevenue.toLocaleString('en-PH')}`} change={metrics.revenueChange} icon={<DollarSign className="w-5 h-5 text-white" />} iconBg="bg-purple-500" />
          </div>
          <OutletStatusGrid outlets={outlets} />
        </>
      ) : metricsQuery.isError ? (
        <SectionError message={metricsQuery.error instanceof Error ? metricsQuery.error.message : 'Failed to load metrics'} onRetry={() => void metricsQuery.refetch({ cancelRefetch: true })} />
      ) : <SectionSkeleton />}

      {revenueChart && orderStatusChart ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <RevenueChart data={revenueChart} />
          <OrderStatusChart data={orderStatusChart} />
        </div>
      ) : chartsQuery.isError ? (
        <SectionError message={chartsQuery.error instanceof Error ? chartsQuery.error.message : 'Failed to load charts'} onRetry={() => void chartsQuery.refetch({ cancelRefetch: true })} />
      ) : <SectionSkeleton className="h-80" />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {topProducts ? <TopProductsChart data={topProducts} /> : chartsQuery.isError ? <SectionError message="Failed to load top products" onRetry={() => void chartsQuery.refetch({ cancelRefetch: true })} /> : <SectionSkeleton />}
        {activeDeliveries ? <ActiveDeliveriesList deliveries={activeDeliveries} /> : tablesQuery.isError ? <SectionError message="Failed to load deliveries" onRetry={() => void tablesQuery.refetch({ cancelRefetch: true })} /> : <SectionSkeleton />}
      </div>

      {pendingOrders && recentOrders ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <PendingOrdersTable orders={pendingOrders} />
          <RecentOrdersTable orders={recentOrders} />
        </div>
      ) : tablesQuery.isError ? (
        <SectionError message={tablesQuery.error instanceof Error ? tablesQuery.error.message : 'Failed to load orders'} onRetry={() => void tablesQuery.refetch({ cancelRefetch: true })} />
      ) : <SectionSkeleton />}
    </div>
  );
}
