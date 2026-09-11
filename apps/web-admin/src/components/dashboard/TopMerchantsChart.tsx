'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { TopMerchant } from '@/lib/dashboard-types';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface TopMerchantsChartProps {
  data: TopMerchant[];
}

export function TopMerchantsChart({ data }: TopMerchantsChartProps) {
  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'shadow' as const },
      backgroundColor: '#171717',
      borderColor: '#262626',
      borderWidth: 1,
      textStyle: { color: '#ededed', fontSize: 12 },
    },
    grid: {
      top: 10,
      right: 10,
      bottom: 10,
      left: 10,
      containLabel: true,
    },
    xAxis: {
      type: 'value' as const,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#262626' } },
      axisLabel: { color: '#a1a1aa', fontSize: 11 },
    },
    yAxis: {
      type: 'category' as const,
      data: data.map((d) => d.name),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#ededed',
        fontSize: 12,
        width: 120,
        overflow: 'truncate' as const,
      },
      inverse: true,
    },
    series: [
      {
        type: 'bar',
        data: data.map((d) => d.orders),
        barWidth: 20,
        itemStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#2563eb' },
              { offset: 1, color: '#60a5fa' },
            ],
          },
          borderRadius: [0, 4, 4, 0],
        },
        label: {
          show: true,
          position: 'right' as const,
          color: '#a1a1aa',
          fontSize: 11,
          formatter: '{c} orders',
        },
      },
    ],
  }), [data]);

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Top Merchants by Orders</h3>
      <ReactECharts option={option} style={{ height: 280 }} />
    </div>
  );
}
