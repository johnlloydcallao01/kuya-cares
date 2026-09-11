'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useNotifications } from '@/contexts/NotificationsContext'
import { NotificationsPanel } from './NotificationsPanel'

export function NotificationBell() {
  const router = useRouter()
  const notifications = useNotifications()
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [drawerMounted, setDrawerMounted] = useState(false)
  const [closeTimer, setCloseTimer] = useState<number | null>(null)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => setIsMobile(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const handleClick = () => {
    if (isMobile) {
      void notifications?.markAllAsSeen()
      router.push('/notifications')
      return
    }
    void notifications?.markAllAsSeen()
    if (open) {
      setOpen(false)
      const timer = window.setTimeout(() => setDrawerMounted(false), 220)
      setCloseTimer(timer)
    } else {
      if (closeTimer !== null) window.clearTimeout(closeTimer)
      setDrawerMounted(true)
      requestAnimationFrame(() => setOpen(true))
    }
  }

  const closeDrawer = () => {
    setOpen(false)
    const timer = window.setTimeout(() => setDrawerMounted(false), 220)
    setCloseTimer(timer)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleClick}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[var(--card-border)] bg-[var(--card-background)] text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <i className="fa fa-bell text-sm" />
        {!!notifications?.unseenCount && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {notifications.unseenCount > 9 ? '9+' : notifications.unseenCount}
          </span>
        )}
      </button>
      {drawerMounted && !isMobile && (
        <div className={`fixed inset-0 z-[60] bg-black/30 transition-opacity duration-200 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer() }}>
          <div className={`ml-auto h-full w-full max-w-md transform transition-transform duration-200 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}>
            <NotificationsPanel mode="modal" onClose={closeDrawer} />
          </div>
        </div>
      )}
    </div>
  )
}