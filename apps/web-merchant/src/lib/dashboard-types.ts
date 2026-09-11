export interface MerchantDashboardMetrics {
  totalRevenue: number;
  revenueChange: number;
  todayRevenue: number;
  totalOrders: number;
  ordersChange: number;
  pendingOrders: number;
  activeOrders: number;
  totalOutlets: number;
  openOutlets: number;
  acceptingOrders: number;
  averageRating: number;
  totalReviews: number;
  ratingChange: number;
}

export interface OutletStatus {
  id: string;
  name: string;
  operationalStatus: string;
  isAcceptingOrders: boolean;
  todayOrders: number;
  todayRevenue: number;
  avgDeliveryTime: number;
}

export interface DailyRevenue {
  date: string;
  revenue: number;
  orders: number;
}

export interface OrderStatusBreakdown {
  status: string;
  count: number;
}

export interface TopProduct {
  id: string;
  name: string;
  totalSold: number;
  revenue: number;
}

export interface ActiveDelivery {
  orderId: string;
  outletName: string;
  status: string;
  customerAddress: string;
  driverName: string | null;
  placedAt: string;
}

export interface PendingOrder {
  id: string;
  outletName: string;
  customerEmail: string;
  total: number;
  itemCount: number;
  placedAt: string;
  fulfillmentType: string;
}

export interface RecentOrder {
  id: string;
  merchantName: string;
  customerEmail: string;
  total: number;
  status: string;
  createdAt: string;
}

export interface MerchantDashboardData {
  metrics: MerchantDashboardMetrics;
  outlets: OutletStatus[];
  revenueChart: DailyRevenue[];
  orderStatusChart: OrderStatusBreakdown[];
  topProducts: TopProduct[];
  activeDeliveries: ActiveDelivery[];
  pendingOrders: PendingOrder[];
  recentOrders: RecentOrder[];
}
