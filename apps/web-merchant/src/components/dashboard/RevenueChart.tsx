'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { DailyRevenue } from '@/lib/dashboard-types';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface RevenueChartProps {
  data: DailyRevenue[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#171717',
      borderColor: '#262626',
      borderWidth: 1,
      textStyle: { color: '#ededed', fontSize: 12 },
      formatter: (params: Array<{ name: string; value: number; seriesName: string }>) => {
        const item = params[0];
        return `<div style="font-weight:600;margin-bottom:4px">${item.name}</div>
                <div style="color:#a1a1aa">${item.seriesName}: <span style="font-weight:600;color:#ededed">₱${item.value.toLocaleString()}</span></div>`;
      },
    },
    grid: {
      top: 10,
      right: 10,
      bottom: 30,
      left: 50,
    },
    xAxis: {
      type: 'category' as const,
      data: data.map((d) => d.date),
      axisLine: { lineStyle: { color: '#262626' } },
      axisLabel: { color: '#a1a1aa', fontSize: 11 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#262626' } },
      axisLabel: {
        color: '#a1a1aa',
        fontSize: 11,
        formatter: (val: number) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : String(val),
      },
    },
    series: [
      {
        name: 'Revenue',
        type: 'line',
        data: data.map((d) => d.revenue),
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
      },
    ],
  }), [data]);

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] p-6">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Revenue (Last 30 Days)</h3>
      <ReactECharts option={option} style={{ height: 280 }} />
    </div>
  );
}
