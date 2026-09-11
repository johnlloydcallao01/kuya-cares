export interface AnalyticsKpis {
  totalRevenue: number
  totalOrders: number
  aov: number
  activeMerchants: number
  totalVendors: number
  totalCustomers: number
  newCustomers: number
  paidTransactions: number
  refundedTransactions: number
  failedTransactions: number
  wishlistCount: number
  avgRating: number
  revenueChange: number
  ordersChange: number
  aovChange: number
  customersChange: number
  totalRevenueAllTime: number
  totalOrdersAllTime: number
}
export interface RevenueTrendPoint { date: string; revenue: number; orders: number; aov: number }
export interface StatusCount { status: string; count: number }
export interface FulfillmentMix { type: string; count: number }
export interface PaymentMethodCount { method: string; count: number }
export interface BusinessTypeRevenue { businessType: string; revenue: number; orders: number }
export interface CategoryRevenue { category: string; revenue: number; quantity: number }
export interface TopProduct { id: string; name: string; revenue: number; quantity: number; orders: number }
export interface TopMerchant { id: string; name: string; orders: number; revenue: number; rating: number }
export interface TopVendor { id: string; businessName: string; orders: number; revenue: number; totalMerchants: number; averageRating: number; verificationStatus: string }
export interface HourlyPoint { hour: number; orders: number; revenue: number }
export interface WeekdayPoint { day: string; orders: number; revenue: number }
export interface RatingBucket { rating: number; count: number }

export interface AnalyticsData {
  meta: { range: string; days: number; generatedAt: string; totalOrdersAllTime: number }
  kpis: AnalyticsKpis
  revenueTrend: RevenueTrendPoint[]
  orderStatusBreakdown: StatusCount[]
  fulfillmentMix: FulfillmentMix[]
  deliveryStatusBreakdown: StatusCount[]
  bookingStatusBreakdown: StatusCount[]
  paymentMethodBreakdown: PaymentMethodCount[]
  transactionStatusBreakdown: StatusCount[]
  revenueByBusinessType: BusinessTypeRevenue[]
  revenueByCategory: CategoryRevenue[]
  topProducts: TopProduct[]
  topMerchants: TopMerchant[]
  topVendors: TopVendor[]
  hourlyDistribution: HourlyPoint[]
  weekdayDistribution: WeekdayPoint[]
  ratingDistribution: RatingBucket[]
  vendorVerificationBreakdown: StatusCount[]
  driverStatusBreakdown: StatusCount[]
  funnel: {
    cartByStatus: StatusCount[]
    cartCurrentByStatus: StatusCount[]
    abandonmentRate: number
    totalCarts: number
    totalCartsCurrent: number
  }
}
