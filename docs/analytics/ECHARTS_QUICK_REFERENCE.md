# ECharts Quick Reference - Tap2Go

## 🚀 Quick Decision Guide

### Use BaseChart (90%) When:
- ✅ Standard business charts (bar, line, pie)
- ✅ Dashboard analytics
- ✅ Static or semi-static data
- ✅ Quick implementation needed
- ✅ Basic interactivity

### Use Direct ECharts (10%) When:
- ✅ Real-time data streaming
- ✅ Complex custom interactions
- ✅ Performance critical (>10k data points)
- ✅ Advanced animations
- ✅ WebSocket integration

## 📋 Quick Implementation

### BaseChart (90% Use Case)
```typescript
import BaseChart from '@/components/analytics/BaseChart';

const MyChart = ({ data }) => {
  const option = {
    xAxis: { type: 'category', data: data.labels },
    yAxis: { type: 'value' },
    series: [{ data: data.values, type: 'bar' }]
  };

  return (
    <BaseChart 
      option={option} 
      config={{ title: 'My Chart', height: 400 }}
    />
  );
};
```

### Direct ECharts (10% Use Case)
```typescript
import { DirectChart } from '@/components/analytics/DirectECharts';

const MyRealTimeChart = () => {
  const [data, setData] = useState([]);

  const option = {
    // Your ECharts configuration
    series: [{ data, type: 'line' }]
  };

  return (
    <DirectChart 
      option={option}
      onChartReady={(chart) => {
        // Custom event handling
      }}
    />
  );
};
```

## 🎨 Tap2Go Colors

```typescript
// Use these in your charts
const TAP2GO_COLORS = {
  primary: '#f3a823',    // Main orange
  secondary: '#ef7b06',  // Dark orange
  success: '#10b981',    // Green
  warning: '#f59e0b',    // Yellow
  error: '#ef4444',      // Red
  info: '#3b82f6',       // Blue
};
```

## ✅ Code Review Checklist

### BaseChart (90%)
- [ ] Uses BaseChart component
- [ ] Tap2Go colors applied
- [ ] TypeScript interfaces
- [ ] Loading/error states
- [ ] Responsive design

### Direct ECharts (10%)
- [ ] Justification documented
- [ ] Chart disposal implemented
- [ ] SSR compatibility
- [ ] Performance optimized
- [ ] Memory leak prevention

## 🚨 Common Mistakes

### DON'T
- ❌ Use Direct ECharts for simple charts
- ❌ Forget to dispose chart instances
- ❌ Skip SSR compatibility checks
- ❌ Ignore performance implications
- ❌ Mix approaches unnecessarily

### DO
- ✅ Follow the 90/10 rule
- ✅ Use TypeScript interfaces
- ✅ Implement proper cleanup
- ✅ Test on mobile devices
- ✅ Document custom implementations

## 📱 Panel-Specific Guidelines

### Admin Panel
- Revenue charts → BaseChart (90%)
- Real-time monitoring → Direct ECharts (10%)
- Geographic maps → Direct ECharts (10%)

### Vendor Panel
- Sales reports → BaseChart (90%)
- Menu analytics → BaseChart (90%)
- Live orders → Direct ECharts (10%)

### Driver Panel
- Earnings → BaseChart (90%)
- Route maps → Direct ECharts (10%)
- Performance → BaseChart (90%)

### Customer App
- Order history → BaseChart (90%)
- Preferences → BaseChart (90%)
- Live tracking → Direct ECharts (10%)

## 🔧 Troubleshooting

### Chart Not Rendering
1. Check data format
2. Verify container dimensions
3. Ensure proper imports

### Performance Issues
1. Reduce data points
2. Use pagination
3. Consider Direct ECharts

### Memory Leaks
1. Implement chart disposal
2. Check useEffect cleanup
3. Monitor in dev tools

## 📚 Resources

- **Full Documentation**: `/docs/ECHARTS_IMPLEMENTATION_GUIDE.md`
- **Live Demo**: `/analytics-demo`
- **BaseChart Component**: `/src/components/analytics/BaseChart.tsx`
- **Direct ECharts**: `/src/components/analytics/DirectECharts.tsx`

---

**Remember**: When in doubt, start with BaseChart (90%). Only use Direct ECharts (10%) when you have a specific need that BaseChart cannot fulfill.
