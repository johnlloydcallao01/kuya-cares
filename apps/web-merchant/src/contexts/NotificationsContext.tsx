'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { getMyNotifications, markAllMyNotifications, updateMyNotification, type MerchantNotification } from '@/app/actions/notifications'

interface NotificationsContextValue {
  notifications: MerchantNotification[]
  unreadCount: number
  unseenCount: number
  isLoading: boolean
  markAsRead: (id: number | string) => Promise<void>
  markAsUnread: (id: number | string) => Promise<void>
  markAllAsRead: () => Promise<void>
  markAllAsSeen: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null)

export function NotificationsProvider({ children, userId }: { children: React.ReactNode; userId?: number | string }) {
  const [notifications, setNotifications] = useState<MerchantNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [unseenCount, setUnseenCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const supabaseRef = useRef<SupabaseClient | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)
    try {
      const result = await getMyNotifications()
      if (!result) return
      setNotifications(result.docs)
      setUnreadCount(result.unreadCount)
      setUnseenCount(result.unseenCount)
    } catch (error) {
      console.error('[MerchantNotifications] Failed to fetch notifications', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => { void fetchNotifications() }, [fetchNotifications])

  useEffect(() => {
    if (!userId) return
    const refresh = () => { void fetchNotifications() }
    const interval = window.setInterval(refresh, 30000)
    window.addEventListener('focus', refresh)
    return () => { window.clearInterval(interval); window.removeEventListener('focus', refresh) }
  }, [fetchNotifications, userId])

  useEffect(() => {
    if (!userId) return
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) return
    const supabase = createClient(url, key)
    supabaseRef.current = supabase
    const channel = supabase.channel(`notifications:user:${userId}`, { config: { broadcast: { self: true } } })
      .on('broadcast', { event: 'new_notification' }, () => { void fetchNotifications() })
      .on('broadcast', { event: 'notification_read' }, () => { void fetchNotifications() })
      .subscribe()
    channelRef.current = channel
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      channelRef.current = null
      supabaseRef.current = null
    }
  }, [fetchNotifications, userId])

  const markAsRead = useCallback(async (id: number | string) => {
    const item = notifications.find((notification) => notification.id === id)
    if (!item || item.status !== 'unread') return
    const readAt = new Date().toISOString()
    await updateMyNotification(id, { status: 'read', readAt })
    setNotifications((items) => items.map((notification) => notification.id === id ? { ...notification, status: 'read', readAt } : notification))
    setUnreadCount((count) => Math.max(0, count - 1))
  }, [notifications])

  const markAsUnread = useCallback(async (id: number | string) => {
    const item = notifications.find((notification) => notification.id === id)
    if (!item || item.status === 'unread') return
    await updateMyNotification(id, { status: 'unread', readAt: null })
    setNotifications((items) => items.map((notification) => notification.id === id ? { ...notification, status: 'unread', readAt: null } : notification))
    setUnreadCount((count) => count + 1)
  }, [notifications])

  const markAllAsRead = useCallback(async () => {
    if (!unreadCount) return
    const readAt = new Date().toISOString()
    await markAllMyNotifications({ status: 'read' })
    setNotifications((items) => items.map((item) => ({ ...item, status: 'read', readAt: item.readAt || readAt })))
    setUnreadCount(0)
  }, [unreadCount])

  const markAllAsSeen = useCallback(async () => {
    if (!unseenCount) return
    const seenAt = new Date().toISOString()
    setNotifications((items) => items.map((item) => ({ ...item, seenAt: item.seenAt || seenAt })))
    setUnseenCount(0)
    try {
      await markAllMyNotifications({ seenAt })
    } catch (error) {
      console.error('[MerchantNotifications] Failed to mark notifications seen', error)
      await fetchNotifications()
    }
  }, [fetchNotifications, unseenCount])

  return <NotificationsContext.Provider value={{ notifications, unreadCount, unseenCount, isLoading, markAsRead, markAsUnread, markAllAsRead, markAllAsSeen }}>{children}</NotificationsContext.Provider>
}

export function useNotifications() { return useContext(NotificationsContext) }

export function getNotificationIcon(typeKey: string) {
  if (typeKey.startsWith('order.')) return 'fa-shopping-bag'
  if (typeKey.startsWith('payment.')) return 'fa-credit-card'
  if (typeKey.startsWith('delivery.')) return 'fa-truck'
  if (typeKey.startsWith('security.')) return 'fa-shield'
  return 'fa-bell'
}

export function getNotificationPath(notification: MerchantNotification) {
  if (notification.typeKey.startsWith('order.')) {
    const orderId = notification.metadata?.orderId ?? notification.sourceEntityId
    if (typeof orderId !== 'number' && typeof orderId !== 'string') return null
    return `/orders/${encodeURIComponent(String(orderId))}`
  }
  return null
}

export function getTimeAgo(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return date.toLocaleDateString()
}
