import type { LalamoveStop, LalamoveQuotationResponse, LalamoveOrderResponse, LalamoveDriverDetails } from '../lalamoveClient'

export type DeliveryStatus = 
  | 'pending'
  | 'assigning_driver'
  | 'driver_assigned'
  | 'picked_up'
  | 'completed'
  | 'canceled'
  | 'rejected'
  | 'expired'

export const mapLalamoveStatus = (status: string): DeliveryStatus => {
  switch (status) {
    case 'ASSIGNING_DRIVER': return 'assigning_driver'
    case 'DRIVER_ASSIGNED':  return 'driver_assigned'
    case 'ON_GOING':         return 'driver_assigned'
    case 'PICKED_UP':        return 'picked_up'
    case 'COMPLETED':        return 'completed'
    case 'CANCELED':         return 'canceled'
    case 'REJECTED':         return 'rejected'
    case 'EXPIRED':          return 'expired'
    default:                 return 'pending'
  }
}

export function mapToOrderStatus(deliveryStatus: DeliveryStatus): string | null {
  switch (deliveryStatus) {
    case 'assigning_driver': return 'preparing'
    case 'driver_assigned':  return 'ready_for_pickup'
    case 'picked_up':        return 'on_delivery'
    case 'completed':        return 'delivered'
    case 'canceled':
    case 'expired':          return 'cancelled'
    default:                 return null
  }
}

export function mapToOrderTrackingStatus(deliveryStatus: DeliveryStatus): string {
  switch (deliveryStatus) {
    case 'assigning_driver': return 'accepted'
    case 'driver_assigned':  return 'preparing'
    case 'picked_up':        return 'picked_up'
    case 'completed':        return 'completed'
    case 'canceled':
    case 'expired':          return 'cancelled'
    default:                 return 'accepted'
  }
}

export interface DeliveryQuotationResult {
  quotationId: string
  serviceType: string
  deliveryFee: number
  priorityFee: number
  currency: string
  distance: { value: number; unit: string }
  expiresAt: string
  stops: Array<{
    stopId: string
    coordinates: { lat: string; lng: string }
    address: string
  }>
}

export interface DeliveryOrderResult {
  orderId: string
  quotationId: string
  priceBreakdown: {
    total: string
    currency: string
    priorityFee?: string
  }
  driverId: string
  shareLink: string
  status: string
  distance: { value: string; unit: string }
}

export interface DeliveryTrackResult {
  deliveryStatus: string
  lalamoveRawStatus: string
  driver: {
    driverId: string
    name: string
    phone: string
    plateNumber: string
    photoUrl: string
    lat: number
    lng: number
    locationUpdatedAt: string
  } | null
  pickup: { lat: number; lng: number; address: string } | null
  dropoff: { lat: number; lng: number; address: string } | null
}

export interface DeliveryProvider {
  readonly name: string

  getQuotation(
    stops: LalamoveStop[],
    serviceType?: string,
    options?: { language?: string },
  ): Promise<LalamoveQuotationResponse>

  getQuotationResponse(): Omit<LalamoveQuotationResponse, never>

  placeOrder(params: {
    quotation: LalamoveQuotationResponse
    senderName: string
    senderPhone: string
    recipients: Array<{ name: string; phone: string; remarks?: string }>
    isPODEnabled?: boolean
    metadata?: Record<string, string>
  }): Promise<LalamoveOrderResponse>

  cancelOrder(orderId: string): Promise<void>
  addPriorityFee(orderId: string, feeAmount: string): Promise<any>
  getOrderDetails(orderId: string): Promise<any>
  getDriverDetails(orderId: string, driverId: string): Promise<LalamoveDriverDetails>
  getServiceTypeDefault(): string
  getPriorityFeeEnv(): string
}
