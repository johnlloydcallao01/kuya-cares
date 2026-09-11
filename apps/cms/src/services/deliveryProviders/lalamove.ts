import type { Payload } from 'payload'
import {
  getQuotation as lalamoveGetQuotation,
  placeOrder as lalamovePlaceOrder,
  cancelOrder as lalamoveCancelOrder,
  addPriorityFee as lalamoveAddPriorityFee,
  getOrderDetails as lalamoveGetOrderDetails,
  getDriverDetails as lalamoveGetDriverDetails,
  type LalamoveStop,
  type LalamoveQuotationResponse,
  type LalamoveOrderResponse,
  type LalamoveDriverDetails,
} from '../lalamoveClient'
import type { DeliveryProvider } from './types'

export function createLalamoveProvider(
  payload: Payload,
): DeliveryProvider {
  return {
    name: 'lalamove',

    async getQuotation(stops, serviceType, options) {
      return lalamoveGetQuotation(stops, serviceType as any, options)
    },

    getQuotationResponse(): LalamoveQuotationResponse {
      throw new Error('Direct lalamoveClient access not available through provider')
    },

    async placeOrder(params) {
      return lalamovePlaceOrder(params)
    },

    async cancelOrder(orderId) {
      return lalamoveCancelOrder(orderId)
    },

    async addPriorityFee(orderId, feeAmount) {
      return lalamoveAddPriorityFee(orderId, feeAmount)
    },

    async getOrderDetails(orderId) {
      return lalamoveGetOrderDetails(orderId)
    },

    async getDriverDetails(orderId, driverId) {
      return lalamoveGetDriverDetails(orderId, driverId)
    },

    getServiceTypeDefault(): string {
      return 'MOTORCYCLE'
    },

    getPriorityFeeEnv(): string {
      return process.env.LALAMOVE_PRIORITY_FEE || '20'
    },
  }
}
