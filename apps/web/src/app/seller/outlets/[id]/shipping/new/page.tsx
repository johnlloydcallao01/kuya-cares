'use client'

import { useParams } from 'next/navigation'
import { ClientOnly } from '@/app/seller/_components/ClientOnly'
import ShippingZoneEditor, { ShippingZoneEditorSkeleton } from '../_components/ShippingZoneEditor'

export default function NewShippingZonePage() {
  const params = useParams<{ id: string }>()

  return (
    <ClientOnly fallback={<ShippingZoneEditorSkeleton />}>
      <ShippingZoneEditor key={params.id} mode="create" />
    </ClientOnly>
  )
}
