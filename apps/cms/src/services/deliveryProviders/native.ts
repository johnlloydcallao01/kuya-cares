import type { Payload } from 'payload'
import type {
  LalamoveStop,
  LalamoveQuotationResponse,
  LalamoveOrderResponse,
  LalamoveDriverDetails,
} from '../lalamoveClient'
import type { DeliveryProvider } from './types'

export function createNativeProvider(
  payload: Payload,
): DeliveryProvider {
  return {
    name: 'native',

    getQuotationResponse(): LalamoveQuotationResponse {
      throw new Error('Native provider does not support external quotations')
    },

    async getQuotation(): Promise<LalamoveQuotationResponse> {
      throw new Error('Native provider does not support Lalamove quotations')
    },

    async placeOrder(): Promise<LalamoveOrderResponse> {
      throw new Error('Native delivery booking is not yet implemented')
    },

    async cancelOrder(): Promise<void> {
      throw new Error('Native delivery cancellation is not yet implemented')
    },

    async addPriorityFee(): Promise<any> {
      // No-op for native provider
      return null
    },

    async getOrderDetails(): Promise<any> {
      throw new Error('Native delivery tracking is not yet implemented')
    },

    async getDriverDetails(): Promise<LalamoveDriverDetails> {
      throw new Error('Native driver details are not yet implemented')
    },

    getServiceTypeDefault(): string {
      return 'native'
    },

    getPriorityFeeEnv(): string {
      return '0'
    },
  }
}
