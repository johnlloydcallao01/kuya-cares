export interface VendorKpis {
  totalRevenue: number
  revenueChange: number
  todayRevenue: number
  totalOrders: number
  ordersChange: number
  pendingOrders: number
  activeOrders: number
  totalOutlets: number
  openOutlets: number
  acceptingOrders: number
  averageRating: number
  totalReviews: number
  aov: number
  paidCount: number
  refundedCount: number
  failedCount: number
}
export interface VendorAnalyticsData {
  meta: { range: string; days: number; generatedAt: string; vendorId: string; vendorName: string; totalOrdersAllTime: number; periodStart: string | null; periodEnd: string }
  kpis: VendorKpis
  outlets: { id: string; name: string; operationalStatus: string; isAcceptingOrders: boolean; todayOrders: number; todayRevenue: number; avgDeliveryTime: number }[]
  revenueTrend: { date: string; revenue: number; orders: number }[]
  orderStatusBreakdown: { status: string; count: number }[]
  fulfillmentMix: { type: string; count: number }[]
  deliveryStatusBreakdown: { status: string; count: number }[]
  paymentMethodBreakdown: { method: string; count: number }[]
  revenueByOutlet: { outletId: string; outletName: string; revenue: number; orders: number }[]
  revenueByCategory: { category: string; revenue: number; quantity: number }[]
  topProducts: { id: string; name: string; quantity: number; revenue: number; orders: number }[]
  hourlyDistribution: { hour: number; orders: number; revenue: number }[]
  weekdayDistribution: { day: string; orders: number; revenue: number }[]
  ratingDistribution: { rating: number; count: number }[]
}
