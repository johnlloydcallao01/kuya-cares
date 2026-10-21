'use client'

import { useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useJsApiLoader } from '@react-google-maps/api'
import {
  ShippingZoneEditor as SharedShippingZoneEditor,
  ShippingZoneEditorSkeleton,
  type ShippingOutletSettings,
  type ShippingSettings,
} from '@encreasl/ui/shipping-zones'

export { ShippingZoneEditorSkeleton }

type Props = {
  mode: 'create' | 'edit'
  zoneId?: string
}

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_MAPS_BACKEND_KEY || ''
const MAP_LIBRARIES: ('places' | 'geometry')[] = ['places', 'geometry']

export default function ShippingZoneEditor({ mode, zoneId }: Props) {
  const { id: outletId } = useParams<{ id: string }>()
  const router = useRouter()
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'web-admin-shipping-zone-map',
    googleMapsApiKey: GOOGLE_KEY,
    libraries: MAP_LIBRARIES,
  })

  const loadSettings = useCallback(async (id: string): Promise<ShippingOutletSettings> => {
    const response = await fetch(`/api/merchants/${encodeURIComponent(id)}/shipping-settings?_t=${Date.now()}`, {
      cache: 'no-store',
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Unable to load outlet shipping settings.')
    const outlet = result.outlet as ShippingOutletSettings | undefined
    if (!outlet) throw new Error('The requested outlet was not returned by the server.')
    return outlet
  }, [])

  const saveSettings = useCallback(async (id: string, settings: ShippingSettings) => {
    const response = await fetch(`/api/merchants/${encodeURIComponent(id)}/shipping-settings`, {
      method: 'PUT',
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
      returnHref={`/merchants/${encodeURIComponent(outletId)}/shipping`}
      loadSettings={loadSettings}
      saveSettings={saveSettings}
      onSaved={() => router.push(`/merchants/${encodeURIComponent(outletId)}/shipping`)}
      isMapLoaded={isLoaded}
      mapLoadError={GOOGLE_KEY ? loadError : new Error('Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to use the shipping-zone map.')}
      footerNote="Admin-managed delivery coverage and rates for this outlet."
    />
  )
}
