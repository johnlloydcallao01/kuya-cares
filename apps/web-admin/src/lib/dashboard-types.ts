export interface DashboardMetrics {
  totalRevenue: number;
  totalOrders: number;
  activeMerchants: number;
  activeDrivers: number;
  totalCustomers: number;
  totalVendors: number;
  revenueChange: number;
  ordersChange: number;
  merchantsChange: number;
  driversChange: number;
}

export interface DailyMetric {
  date: string;
  revenue: number;
  orders: number;
}

export interface OrderStatusCount {
  status: string;
  count: number;
}

export interface TopMerchant {
  id: string;
  name: string;
  orders: number;
  revenue: number;
  rating: number;
}

export interface TopVendor {
  id: string;
  businessName: string;
  totalOrders: number;
  totalMerchants: number;
  averageRating: number;
}

export interface RecentOrder {
  id: string;
  merchantName: string;
  customerEmail: string;
  total: number;
  status: string;
  createdAt: string;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  revenueChart: DailyMetric[];
  orderStatusChart: OrderStatusCount[];
  topMerchants: TopMerchant[];
  topVendors: TopVendor[];
  recentOrders: RecentOrder[];
}
