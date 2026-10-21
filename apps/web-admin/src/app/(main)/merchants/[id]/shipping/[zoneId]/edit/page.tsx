'use client'

import { useParams } from 'next/navigation'
import { ClientOnly } from '@/components/ClientOnly'
import ShippingZoneEditor, { ShippingZoneEditorSkeleton } from '../../_components/ShippingZoneEditor'

export default function EditShippingZonePage() {
  const params = useParams<{ id: string; zoneId: string }>()
  return (
    <ClientOnly fallback={<ShippingZoneEditorSkeleton />}>
      <ShippingZoneEditor mode="edit" zoneId={params.zoneId} />
    </ClientOnly>
  )
}
