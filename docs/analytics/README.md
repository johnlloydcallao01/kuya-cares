# 📊 Analytics Documentation

This folder contains all analytics and charting documentation for the Tap2Go platform.

## 📋 Available Guides

### [ECharts Implementation Guide](./ECHARTS_IMPLEMENTATION_GUIDE.md)
**Comprehensive charting and analytics implementation**
- Strategic 90/10 rule approach
- Detailed implementation examples
- Best practices and performance guidelines
- Do's and Don'ts for both approaches
- Real-world use cases by panel

### [ECharts Quick Reference](./ECHARTS_QUICK_REFERENCE.md)
**Quick decision guide and code snippets**
- Quick decision guide for developers
- Code snippets and examples
- Common troubleshooting tips
- Cheat sheet for daily development

## 🎯 90/10 Rule Strategy

Our analytics implementation follows a strategic approach:

### **90% - ECharts for React**
Use `echarts-for-react` for:
- ✅ Standard business charts (bar, line, pie, area)
- ✅ Dashboard analytics for all panels
- ✅ Static or semi-static data visualization
- ✅ Rapid prototyping and development
- ✅ Charts that don't require complex interactions

### **10% - Direct ECharts**
Use direct ECharts implementation for:
- ✅ Real-time data streaming (live order tracking)
- ✅ Complex custom interactions
- ✅ Performance-critical scenarios (large datasets)
- ✅ Advanced chart types (custom renderers, WebGL)
- ✅ Integration with external systems (WebSockets)

## 🏗️ Technical Architecture

### **Component Structure**
```
src/components/analytics/
├── BaseChart.tsx          # ECharts for React wrapper (90%)
├── DirectECharts.tsx      # Direct ECharts implementation (10%)
├── types.ts               # Shared TypeScript interfaces
└── [panel]/               # Panel-specific charts
    ├── AdminCharts.tsx    # Admin panel analytics
    ├── VendorCharts.tsx   # Vendor dashboard charts
    ├── DriverCharts.tsx   # Driver performance metrics
    └── CustomerCharts.tsx # Customer insights
```

### **API Interfaces**
```typescript
// BaseChart Component (90% use case)
interface BaseChartProps {
  option: EChartsOption;
  config?: ChartConfig;
  className?: string;
  onChartClick?: (params: any) => void;
}

// DirectChart Component (10% use case)
interface DirectChartProps {
  option: EChartsOption;
  config?: ChartConfig;
  onChartReady?: (chartInstance: ECharts) => void;
}
```

## 🎨 Brand Guidelines

### **Tap2Go Color Palette**
```typescript
export const TAP2GO_COLORS = {
  primary: '#f3a823',    // Tap2Go Orange
  secondary: '#ef7b06',  // Darker Orange
  success: '#10b981',    // Green
  warning: '#f59e0b',    // Yellow
  error: '#ef4444',      // Red
  info: '#3b82f6',       // Blue
};
```

### **Chart Color Scheme**
- Primary charts use Tap2Go orange gradient
- Multi-series charts use the full color palette
- Consistent theming across all panels
- Accessibility-compliant color contrasts

## 📱 Panel Implementation

### **Admin Panel Analytics**
- **Revenue Analytics** (90%): Monthly/yearly revenue charts
- **Real-time Monitoring** (10%): Live order tracking with WebSockets
- **Geographic Insights** (10%): Delivery heatmaps with map integration
- **Performance Metrics** (90%): KPI dashboards and reports

### **Vendor Panel Charts**
- **Sales Reports** (90%): Daily/weekly sales performance
- **Menu Analytics** (90%): Item popularity and performance
- **Live Order Queue** (10%): Real-time order management
- **Customer Insights** (90%): Customer behavior analysis

### **Driver Panel Metrics**
- **Earnings Tracking** (90%): Weekly/monthly earnings summaries
- **Route Optimization** (10%): GPS-based route analytics
- **Performance Stats** (90%): Delivery time and rating metrics
- **Activity Monitoring** (90%): Work schedule and availability

### **Customer App Insights**
- **Order History** (90%): Spending patterns and preferences
- **Restaurant Ratings** (90%): Preference analysis charts
- **Live Tracking** (10%): Real-time delivery status updates
- **Loyalty Analytics** (90%): Points and rewards visualization

## 🚀 Performance Optimization

### **ECharts for React (90%)**
- React.memo for chart components
- Proper dependency arrays in useEffect
- useMemo for expensive calculations
- Limit data points (<5k for smooth performance)

### **Direct ECharts (10%)**
- Efficient data updates (avoid full re-renders)
- Canvas renderer for better performance
- Dirty rectangle optimization
- Memory usage monitoring

## 🧪 Testing & Quality

### **Code Review Checklist**
#### For ECharts for React (90%)
- [ ] Uses BaseChart component
- [ ] Follows Tap2Go theming
- [ ] Implements proper TypeScript interfaces
- [ ] Handles loading and error states
- [ ] Responsive design implemented

#### For Direct ECharts (10%)
- [ ] Justification documented
- [ ] Proper chart disposal implemented
- [ ] SSR compatibility handled
- [ ] Performance optimizations applied
- [ ] Memory leak prevention measures

### **Testing Strategies**
- Unit tests for chart components
- Visual regression testing
- Performance benchmarking
- Cross-browser compatibility
- Mobile responsiveness testing

## 🎯 Decision Tree

```
Need a chart?
├── Standard business chart? → Use BaseChart (90%)
├── Real-time updates needed? → Consider Direct ECharts (10%)
├── Performance critical? → Consider Direct ECharts (10%)
├── Custom interactions? → Consider Direct ECharts (10%)
└── Default case → Use BaseChart (90%)
```

## 📚 Learning Resources

### **For Junior Developers**
- Start with BaseChart (90% approach)
- Follow existing patterns and examples
- Focus on ECharts fundamentals through React wrapper
- Consult senior developers for Direct ECharts

### **For Senior Developers**
- Evaluate each use case against 90/10 rule
- Review Direct ECharts for performance
- Maintain and improve BaseChart component
- Mentor team on best practices

## 📞 Support

For analytics-related issues:
1. Check the [Implementation Guide](./ECHARTS_IMPLEMENTATION_GUIDE.md)
2. Refer to the [Quick Reference](./ECHARTS_QUICK_REFERENCE.md)
3. Review live demo at `/analytics-demo`
4. Consult with senior developers for complex cases

---

**Last Updated**: December 2024  
**Maintainer**: Tap2Go Development Team
