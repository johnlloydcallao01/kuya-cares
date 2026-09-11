export interface VendorReportsData{
  meta:{range:string; days:number; generatedAt:string; vendorId:string; vendorName:string; periodStart:string|null; periodEnd:string; totalOrders:number}
  summary:{totalRevenue:number; totalRefunded:number; netRevenue:number; totalOrders:number; avgOrder:number; paidCount:number; refundedCount:number; failedCount:number; totalOutlets:number}
  financialReconciliation:{rows:{transactionId:string; orderId:string; date:string; outlet:string; amount:number; platformFee:number; deliveryFee:number; status:string; paymentMethod:string; gross:number}[]; totals:{gross:number; platformFees:number; deliveryFees:number}; count:number}
  outletPayouts:{rows:{outletId:string; outletName:string; orders:number; gross:number; platformFees:number; deliveryFees:number; net:number}[]; count:number}
  orderVolume:{daily:{date:string; orders:number; revenue:number}[]; totalOrders:number; totalRevenue:number}
  refundsFailures:{rows:{transactionId:string; orderId:string; date:string; amount:number; status:string; paymentMethod:string}[]; count:number}
  productPerformance:{rows:{id:string; name:string; quantity:number; revenue:number; orders:number}[]; count:number}
  deliveryLogistics:{totalBookings:number; byStatus:{status:string;count:number}[]; sampleRows:{orderId:string; status:string; deliveryFee:number; serviceType:string; driverName:string}[]}
}
