'use client'

import { useEffect } from 'react'
import { NotificationsPanel } from '@/components/notifications/NotificationsPanel'
import { useNotifications } from '@/contexts/NotificationsContext'

export default function MerchantNotificationsPage() {
  const markAllAsSeen = useNotifications()?.markAllAsSeen
  useEffect(() => { void markAllAsSeen?.() }, [markAllAsSeen])
  return <NotificationsPanel mode="page" />
}
