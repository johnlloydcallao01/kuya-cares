# ECharts Implementation Guide for Tap2Go

## Overview

This document outlines the ECharts implementation strategy for the Tap2Go food delivery platform. We follow a **90/10 rule** where we use ECharts for React as our default approach for 90% of use cases, and direct ECharts implementation for the remaining 10% that require advanced control.

## Table of Contents

1. [Implementation Strategy](#implementation-strategy)
2. [90/10 Rule Explained](#9010-rule-explained)
3. [When to Use Each Approach](#when-to-use-each-approach)
4. [Implementation Examples](#implementation-examples)
5. [Best Practices](#best-practices)
6. [Do's and Don'ts](#dos-and-donts)
7. [Performance Guidelines](#performance-guidelines)
8. [Troubleshooting](#troubleshooting)

## Implementation Strategy

### Primary Approach: ECharts for React (90%)
- **Package**: `echarts-for-react`
- **Use Case**: Standard charts, dashboards, analytics
- **Benefits**: Easy to implement, React-friendly, good for rapid development

### Secondary Approach: Direct ECharts (10%)
- **Package**: `echarts` (direct import)
- **Use Case**: Advanced features, real-time updates, custom interactions
- **Benefits**: Maximum control, better performance, access to all ECharts features

## 90/10 Rule Explained

### The 90% - ECharts for React
Use `echarts-for-react` for:
- **Standard business charts** (bar, line, pie, area charts)
- **Dashboard analytics** for Admin, Vendor, Driver, Customer panels
- **Static or semi-static data visualization**
- **Rapid prototyping and development**
- **Charts that don't require complex interactions**

### The 10% - Direct ECharts
Use direct ECharts implementation for:
- **Real-time data streaming** (live order tracking, driver locations)
- **Complex custom interactions** (advanced tooltips, custom events)
- **Performance-critical scenarios** (large datasets, frequent updates)
- **Advanced chart types** (custom renderers, WebGL, geographic maps)
- **Integration with external systems** (WebSockets, third-party APIs)

## When to Use Each Approach

### Use ECharts for React When:
✅ Building standard analytics dashboards  
✅ Creating reports for business metrics  
✅ Implementing charts with basic interactivity  
✅ Working with static or periodically updated data  
✅ Need quick implementation and deployment  
✅ Team members are new to ECharts  
✅ Chart requirements are straightforward  

### Use Direct ECharts When:
✅ Building real-time monitoring systems  
✅ Creating custom chart interactions  
✅ Handling large datasets (>10k data points)  
✅ Implementing advanced animations  
✅ Need precise control over chart lifecycle  
✅ Integrating with WebSockets or streaming data  
✅ Building reusable chart libraries  
✅ Performance is critical  

## Implementation Examples

### ECharts for React Example (90% Use Case)
```typescript
// Standard dashboard chart
import BaseChart from '@/components/analytics/BaseChart';

const RevenueChart = ({ data }) => {
  const option = {
    xAxis: { type: 'category', data: data.months },
    yAxis: { type: 'value' },
    series: [{ data: data.revenue, type: 'bar' }]
  };

  return (
    <BaseChart 
      option={option} 
      config={{
        title: 'Monthly Revenue',
        height: 400
      }}
    />
  );
};
```

### Direct ECharts Example (10% Use Case)
```typescript
// Real-time order tracking
import { DirectChart } from '@/components/analytics/DirectECharts';

const RealTimeOrderChart = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const ws = new WebSocket('ws://orders-stream');
    ws.onmessage = (event) => {
      setData(prev => [...prev.slice(-50), JSON.parse(event.data)]);
    };
  }, []);

  const option = {
    // Advanced real-time configuration
    animation: { duration: 300 },
    series: [{ data, type: 'line', smooth: true }]
  };

  return (
    <DirectChart 
      option={option}
      onChartReady={(chart) => {
        // Custom event handling
        chart.on('click', handleOrderClick);
      }}
    />
  );
};
```

## Best Practices

### For ECharts for React (90%)
1. **Use BaseChart Component**: Always use our standardized `BaseChart` wrapper
2. **Consistent Theming**: Apply Tap2Go brand colors and styling
3. **Responsive Design**: Ensure charts work on mobile and desktop
4. **Error Handling**: Implement proper loading and error states
5. **Data Validation**: Validate data before passing to charts

### For Direct ECharts (10%)
1. **Memory Management**: Always dispose charts in cleanup functions
2. **Resize Handling**: Implement proper resize observers
3. **SSR Compatibility**: Use client-side rendering checks
4. **Performance Monitoring**: Monitor chart performance in production
5. **Documentation**: Document custom implementations thoroughly

## Do's and Don'ts

### ✅ DO's

#### General
- **DO** follow the 90/10 rule consistently
- **DO** use TypeScript for all chart implementations
- **DO** implement proper error boundaries
- **DO** test charts on different screen sizes
- **DO** optimize for mobile performance

#### ECharts for React
- **DO** use the BaseChart component as the foundation
- **DO** leverage our pre-built chart configurations
- **DO** follow React best practices (memoization, etc.)
- **DO** use consistent color schemes across all charts

#### Direct ECharts
- **DO** implement proper cleanup in useEffect
- **DO** handle edge cases (empty data, loading states)
- **DO** use ResizeObserver for container changes
- **DO** implement proper TypeScript interfaces

### ❌ DON'Ts

#### General
- **DON'T** mix approaches unnecessarily
- **DON'T** ignore performance implications
- **DON'T** skip accessibility considerations
- **DON'T** hardcode chart dimensions

#### ECharts for React
- **DON'T** bypass the BaseChart component without good reason
- **DON'T** create custom wrappers when BaseChart suffices
- **DON'T** ignore the provided theming system

#### Direct ECharts
- **DON'T** forget to dispose chart instances
- **DON'T** skip SSR compatibility checks
- **DON'T** implement direct ECharts for simple use cases
- **DON'T** ignore memory leaks in development

## Performance Guidelines

### ECharts for React Performance
- Use React.memo for chart components
- Implement proper dependency arrays in useEffect
- Avoid unnecessary re-renders with useMemo
- Limit data points to reasonable amounts (<5k for smooth performance)

### Direct ECharts Performance
- Implement efficient data updates (avoid full re-renders)
- Use canvas renderer for better performance
- Enable dirty rectangle optimization
- Monitor memory usage in production

## Troubleshooting

### Common Issues with ECharts for React
1. **Chart not rendering**: Check if data is properly formatted
2. **Sizing issues**: Ensure container has defined dimensions
3. **Performance problems**: Reduce data points or implement pagination

### Common Issues with Direct ECharts
1. **Memory leaks**: Ensure proper chart disposal
2. **SSR errors**: Implement client-side rendering checks
3. **Resize problems**: Use ResizeObserver and intersection observers

## File Structure

```
src/
├── components/
│   └── analytics/
│       ├── BaseChart.tsx          # ECharts for React wrapper (90%)
│       ├── DirectECharts.tsx      # Direct ECharts implementation (10%)
│       ├── types.ts               # Shared TypeScript interfaces
│       └── [panel]/               # Panel-specific charts
│           ├── AdminCharts.tsx
│           ├── VendorCharts.tsx
│           ├── DriverCharts.tsx
│           └── CustomerCharts.tsx
```

## Migration Strategy

When migrating from ECharts for React to Direct ECharts:
1. Identify performance bottlenecks or feature limitations
2. Create Direct ECharts implementation alongside existing
3. A/B test performance and functionality
4. Gradually migrate if benefits are significant
5. Update documentation and team knowledge

---

**Remember**: The 90/10 rule is a guideline, not a strict requirement. Always choose the approach that best serves the user experience and development efficiency for your specific use case.

For questions or clarifications, refer to the analytics demo at `/analytics-demo` which showcases both approaches side by side.

## Technical Implementation Details

### BaseChart Component API (90% Use Case)

```typescript
interface BaseChartProps {
  option: EChartsOption;
  config?: ChartConfig;
  className?: string;
  onChartClick?: (params: any) => void;
  onChartHover?: (params: any) => void;
}

interface ChartConfig {
  title?: string;
  subtitle?: string;
  height?: number;
  showLegend?: boolean;
  xAxisTitle?: string;
  yAxisTitle?: string;
}
```

### DirectChart Component API (10% Use Case)

```typescript
interface DirectChartProps {
  option: EChartsOption;
  config?: ChartConfig;
  className?: string;
  onChartReady?: (chartInstance: ECharts) => void;
}
```

### Tap2Go Brand Colors

```typescript
export const TAP2GO_COLORS = {
  primary: '#f3a823',    // Tap2Go Orange
  secondary: '#ef7b06',  // Darker Orange
  success: '#10b981',    // Green
  warning: '#f59e0b',    // Yellow
  error: '#ef4444',      // Red
  info: '#3b82f6',       // Blue
};

export const CHART_COLOR_PALETTE = [
  '#f3a823', '#ef7b06', '#10b981', '#f59e0b',
  '#ef4444', '#3b82f6', '#8b5cf6', '#06b6d4'
];
```

## Real-World Use Cases by Panel

### Admin Panel (Mix of 90/10)
- **Revenue Analytics** (90%): Standard bar/line charts using BaseChart
- **Real-time Order Monitoring** (10%): Direct ECharts with WebSocket integration
- **Geographic Delivery Heatmaps** (10%): Direct ECharts with map integration

### Vendor Panel (Mostly 90%)
- **Sales Reports** (90%): BaseChart for daily/monthly sales
- **Menu Performance** (90%): BaseChart for item popularity
- **Live Order Queue** (10%): Direct ECharts for real-time updates

### Driver Panel (Mix of 90/10)
- **Earnings Summary** (90%): BaseChart for weekly/monthly earnings
- **Route Optimization** (10%): Direct ECharts with map integration
- **Performance Metrics** (90%): BaseChart for delivery statistics

### Customer App (Mostly 90%)
- **Order History** (90%): BaseChart for spending patterns
- **Restaurant Ratings** (90%): BaseChart for preference analysis
- **Live Order Tracking** (10%): Direct ECharts for real-time delivery status

## Decision Tree

```
Need a chart?
├── Is it a standard business chart? → Use BaseChart (90%)
├── Does it need real-time updates? → Consider Direct ECharts (10%)
├── Is performance critical? → Consider Direct ECharts (10%)
├── Need custom interactions? → Consider Direct ECharts (10%)
└── Default case → Use BaseChart (90%)
```

## Code Review Checklist

### For ECharts for React (90%)
- [ ] Uses BaseChart component
- [ ] Follows Tap2Go theming
- [ ] Implements proper TypeScript interfaces
- [ ] Handles loading and error states
- [ ] Responsive design implemented
- [ ] Data validation in place

### For Direct ECharts (10%)
- [ ] Justification documented for using direct approach
- [ ] Proper chart disposal implemented
- [ ] SSR compatibility handled
- [ ] Performance optimizations applied
- [ ] Memory leak prevention measures
- [ ] Resize handling implemented
- [ ] Error boundaries in place

## Team Guidelines

### For Junior Developers
- Start with BaseChart (90% approach) for all chart needs
- Only use Direct ECharts after discussing with senior developers
- Follow existing patterns and examples
- Focus on learning ECharts fundamentals through React wrapper

### For Senior Developers
- Evaluate each use case against the 90/10 rule
- Mentor junior developers on when to use each approach
- Review Direct ECharts implementations for performance and memory management
- Maintain and improve BaseChart component

### For Team Leads
- Enforce the 90/10 rule in code reviews
- Monitor performance metrics for chart-heavy pages
- Plan migration strategies for performance-critical charts
- Ensure documentation stays up-to-date

---

**Last Updated**: December 2024
**Version**: 1.0
**Maintainer**: Tap2Go Development Team
