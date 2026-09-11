'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { OrderStatusBreakdown } from '@/lib/dashboard-types';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface OrderStatusChartProps {
  data: OrderStatusBreakdown[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  accepted: '#3b82f6',
  preparing: '#8b5cf6',
  ready_for_pickup: '#06b6d4',
  on_delivery: '#10b981',
  delivered: '#22c55e',
  cancelled: '#ef4444',
};

const FALLBACK_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export function OrderStatusChart({ data }: OrderStatusChartProps) {
  const option = useMemo(() => {
    const total = data.reduce((sum, d) => sum + d.count, 0);

    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#171717',
        borderColor: '#262626',
        borderWidth: 1,
        textStyle: { color: '#ededed', fontSize: 12 },
        formatter: (params: { name: string; value: number; percent: number }) => {
          return `<div style="font-weight:600;margin-bottom:2px;text-transform:capitalize">${params.name.replace(/_/g, ' ')}</div>
                  <div style="color:#a1a1aa">${params.value} orders (${params.percent.toFixed(1)}%)</div>`;
        },
      },
      legend: {
        orient: 'vertical' as const,
        right: 10,
        top: 'center',
        textStyle: { color: '#a1a1aa', fontSize: 12 },
        formatter: (name: string) => name.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 12,
      },
      series: [
        {
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
          emphasis: {
            label: { show: true },
            itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.1)' },
          },
          data: data.map((d, i) => ({
            name: d.status,
            value: d.count,
            itemStyle: { color: STATUS_COLORS[d.status] || FALLBACK_COLORS[i % FALLBACK_COLORS.length] },
          })),
        },
      ],
    };
  }, [data]);

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Order Status</h3>
      <ReactECharts option={option} style={{ height: 280 }} />
    </div>
  );
}
