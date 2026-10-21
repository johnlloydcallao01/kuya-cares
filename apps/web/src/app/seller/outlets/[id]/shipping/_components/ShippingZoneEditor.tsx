'use client'

import { useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ShippingZoneEditor as SharedShippingZoneEditor,
  ShippingZoneEditorSkeleton,
  type ShippingOutletSettings,
  type ShippingSettings,
} from '@encreasl/ui/shipping-zones'
import { useGoogleMapsApi } from '@/lib/google-maps-api'

export { ShippingZoneEditorSkeleton }

type Props = {
  mode: 'create' | 'edit'
  zoneId?: string
}

export default function ShippingZoneEditor({ mode, zoneId }: Props) {
  const { id: outletId } = useParams<{ id: string }>()
  const router = useRouter()
  const { isLoaded: isMapLoaded, loadError } = useGoogleMapsApi()

  const loadSettings = useCallback(async (id: string): Promise<ShippingOutletSettings> => {
    const response = await fetch(`/api/seller-outlets/${encodeURIComponent(id)}?_t=${Date.now()}`, {
      cache: 'no-store',
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Unable to load outlet shipping settings.')
    const outlet = (result.outlet ?? result.doc) as ShippingOutletSettings | undefined
    if (!outlet) throw new Error('The requested outlet was not returned by the server.')
    return outlet
  }, [])

  const saveSettings = useCallback(async (id: string, settings: ShippingSettings) => {
    const response = await fetch(`/api/seller-outlets/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sellerShippingSettings: settings }),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Unable to save shipping settings.')
  }, [])

  return (
    <SharedShippingZoneEditor
      mode={mode}
      zoneId={zoneId}
      outletId={outletId}
      returnHref={`/seller/outlets/${encodeURIComponent(outletId)}/shipping`}
      loadSettings={loadSettings}
      saveSettings={saveSettings}
      onSaved={() => router.push(`/seller/outlets/${encodeURIComponent(outletId)}/shipping`)}
      isMapLoaded={isMapLoaded}
      mapLoadError={loadError}
      footerNote="Shipping fees go to your seller payout. Your delivery arrangement is your responsibility."
    />
  )
}
