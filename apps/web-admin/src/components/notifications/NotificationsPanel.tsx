'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getNotificationIcon, getNotificationPath, getTimeAgo, useNotifications } from '@/contexts/NotificationsContext'

export function NotificationsPanel({ mode = 'page', onClose }: { mode?: 'page' | 'modal'; onClose?: () => void }) {
  const router = useRouter()
  const notifications = useNotifications()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const items = notifications?.notifications || []
  const filtered = useMemo(() => filter === 'unread' ? items.filter((item) => item.status === 'unread') : items, [filter, items])

  if (!notifications) return null

  const openFullPage = () => {
    void notifications.markAllAsSeen()
    onClose?.()
    router.push('/notifications')
  }

  return (
    <section className={mode === 'modal'
      ? 'flex h-full w-full flex-col overflow-hidden border-l border-gray-200 bg-white shadow-2xl dark:border-[var(--card-border)] dark:bg-[var(--card-background)]'
      : 'space-y-6 py-5 px-2.5'}>
      <div className={mode === 'modal' ? 'flex-shrink-0 border-b border-gray-100 px-4 py-4 dark:border-[var(--card-border)]' : ''}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <span className="h-8 w-8 rounded-lg bg-[#eba236] text-white flex items-center justify-center">
                <i className="fa fa-bell text-base leading-none" />
              </span>
              Notifications
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {notifications.unreadCount ? `${notifications.unreadCount} unread notification${notifications.unreadCount === 1 ? '' : 's'}` : 'You are all caught up'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void notifications.markAllAsRead()} disabled={!notifications.unreadCount} className="text-xs font-medium text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40">Mark all read</button>
            {mode === 'modal' && <button type="button" onClick={onClose} aria-label="Close notifications" className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><i className="fa fa-times" /></button>}
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {(['all', 'unread'] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === value ? 'bg-[var(--accent)] text-white' : 'border border-[var(--card-border)] text-gray-600 dark:text-gray-300'}`}>{value === 'all' ? 'All' : 'Unread'}</button>)}
        </div>
      </div>

      <div className={mode === 'modal' ? 'min-h-0 flex-1 overflow-y-auto' : 'overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-[var(--card-border)] dark:bg-[var(--card-background)]'}>
        {notifications.isLoading && !items.length ? <div className="space-y-3 p-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />)}</div> : filtered.length === 0 ? <div className="px-6 py-14 text-center"><i className="fa fa-bell-slash mb-3 text-3xl text-gray-300 dark:text-gray-600" /><p className="text-sm font-medium text-gray-700 dark:text-gray-300">{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">New orders, merchants, customers, payments, and system activity will appear here.</p></div> : <ul className="divide-y divide-gray-100 dark:divide-gray-800">{filtered.map((item) => {
          const notificationPath = getNotificationPath(item)
          return <li key={item.id} className={`group flex gap-3 px-4 py-3 ${item.status === 'unread' ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
          {notificationPath ? <button type="button" onClick={(event) => { event.stopPropagation(); if (item.status === 'unread') void notifications.markAsRead(item.id); router.push(notificationPath); onClose?.() }} className="flex min-w-0 flex-1 cursor-pointer gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]">
            <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${item.priority === 'critical' ? 'bg-red-100 text-red-600' : item.priority === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}><i className={`fa ${getNotificationIcon(item.typeKey)} text-sm`} /></span>
            <div className="min-w-0 flex-1"><p className={`text-sm ${item.status === 'unread' ? 'font-semibold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-700 dark:text-gray-300'}`}>{item.title}</p><p className="mt-0.5 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{item.body}</p><p className="mt-1 text-xs text-gray-400">{getTimeAgo(item.deliveredAt || item.createdAt)}</p></div>
          </button> : <div className="flex min-w-0 flex-1 gap-3">
            <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${item.priority === 'critical' ? 'bg-red-100 text-red-600' : item.priority === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'}`}><i className={`fa ${getNotificationIcon(item.typeKey)} text-sm`} /></span>
            <div className="min-w-0 flex-1"><p className={`text-sm ${item.status === 'unread' ? 'font-semibold text-gray-900 dark:text-gray-100' : 'font-medium text-gray-700 dark:text-gray-300'}`}>{item.title}</p><p className="mt-0.5 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">{item.body}</p><p className="mt-1 text-xs text-gray-400">{getTimeAgo(item.deliveredAt || item.createdAt)}</p></div>
          </div>}
          <div className="flex flex-shrink-0 items-start gap-1 opacity-0 transition-opacity group-hover:opacity-100"><button type="button" onClick={() => void (item.status === 'unread' ? notifications.markAsRead(item.id) : notifications.markAsUnread(item.id))} aria-label={item.status === 'unread' ? 'Mark as read' : 'Mark as unread'} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><i className={`fa ${item.status === 'unread' ? 'fa-envelope' : 'fa-envelope-open'}`} /></button><button type="button" onClick={() => void notifications.deleteNotification(item.id)} aria-label="Delete notification" className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/30"><i className="fa fa-trash" /></button></div>
        </li>})}</ul>}
      </div>
      {mode === 'modal' && <button type="button" onClick={openFullPage} className="flex-shrink-0 border-t border-gray-100 px-4 py-3 text-center text-sm font-medium text-[var(--accent)] hover:bg-gray-50 dark:border-[var(--card-border)] dark:hover:bg-gray-800">View all notifications</button>}
    </section>
  )
}