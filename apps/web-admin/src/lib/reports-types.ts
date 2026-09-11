export interface ReportsData {
  meta: { range: string; periodLabel: string; days: number; generatedAt: string; periodStart: string; periodEnd: string; totalDocs: { vendors: number; merchants: number; orders: number; transactions: number } }
  summary: { totalRevenue: number; totalRefunded: number; netRevenue: number; totalOrders: number; avgOrder: number; totalVendors: number; activeVendors: number; totalMerchants: number; activeMerchants: number; failedCount: number; refundedCount: number; paidCount: number }
  financialReconciliation: { rows: { transactionId: string; orderId: string; date: string; merchant: string; vendor: string; amount: number; platformFee: number; deliveryFee: number; status: string; paymentMethod: string; gross: number }[]; totals: { gross: number; platformFees: number; deliveryFees: number }; count: number; totalCount: number }
  vendorPayouts: { rows: { vendorId: string; businessName: string; orders: number; gross: number; platformFees: number; deliveryFees: number; net: number }[]; count: number }
  orderVolume: { daily: { date: string; orders: number; revenue: number }[]; totalOrders: number; totalRevenue: number }
  refundsFailures: { rows: { transactionId: string; orderId: string; date: string; amount: number; status: string; paymentMethod: string }[]; totals: { refunded: number; failed: number }; count: number }
  productPerformance: { rows: { id: string; name: string; quantity: number; revenue: number; orders: number }[]; count: number }
  vendorCompliance: { rows: { vendorId: string; businessName: string; businessType: string; verificationStatus: string; isActive: boolean; totalMerchants: number; averageRating: number; totalOrders: number }[]; count: number }
  deliveryLogistics: { totalBookings: number; byStatus: { status: string; count: number }[]; sampleRows: { orderId: string; status: string; deliveryFee: number; serviceType: string; driverName: string }[] }
}
