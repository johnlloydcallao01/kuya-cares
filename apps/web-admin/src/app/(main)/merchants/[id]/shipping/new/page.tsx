'use client'

import { ClientOnly } from '@/components/ClientOnly'
import ShippingZoneEditor, { ShippingZoneEditorSkeleton } from '../_components/ShippingZoneEditor'

export default function NewShippingZonePage() {
  return (
    <ClientOnly fallback={<ShippingZoneEditorSkeleton />}>
      <ShippingZoneEditor mode="create" />
    </ClientOnly>
  )
}
