'use client'

import { useEffect } from 'react'
import { NotificationsPanel } from '@/components/notifications/NotificationsPanel'
import { useNotifications } from '@/contexts/NotificationsContext'
import { ClientOnly } from '@/components/ClientOnly'

function NotificationsSkeleton() {
  return (
    <div className="space-y-6 py-5 px-2.5">
      <div className="h-8 w-48 bg-gray-200 dark:bg-[#262626] rounded animate-pulse" />
      <div className="space-y-3 p-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-[#262626]" />)}</div>
    </div>
  )
}

function NotificationsPageContent() {
  const markAllAsSeen = useNotifications()?.markAllAsSeen
  useEffect(() => { void markAllAsSeen?.() }, [markAllAsSeen])
  return <NotificationsPanel mode="page" />
}

export default function NotificationsPage() {
  // Pure CSR: relative timestamps render with Date.now() — identical skeleton until mounted.
  return (
    <ClientOnly fallback={<NotificationsSkeleton />}>
      <NotificationsPageContent />
    </ClientOnly>
  )
}
