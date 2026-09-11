import type { Payload } from 'payload'
import type { DeliveryProvider } from './types'
import { createLalamoveProvider } from './lalamove'
import { createNativeProvider } from './native'

export type { DeliveryProvider, DeliveryStatus } from './types'
export { mapLalamoveStatus, mapToOrderStatus, mapToOrderTrackingStatus } from './types'

export async function getDeliveryProvider(
  payload: Payload,
): Promise<DeliveryProvider> {
  let settings: Record<string, any> = {}
  try {
    settings = (await payload.findGlobal({ slug: 'system-settings' })) as Record<string, any>
  } catch {
    // Fall back to lalamove if system-settings global doesn't exist yet
    return createLalamoveProvider(payload)
  }

  const provider = settings?.deliveryProvider || 'lalamove'

  if (provider === 'native') {
    return createNativeProvider(payload)
  }

  return createLalamoveProvider(payload)
}
