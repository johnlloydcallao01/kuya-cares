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

  const closeDrawer = () => {
    setOpen(false)
    const timer = window.setTimeout(() => setDrawerMounted(false), 220)
    setCloseTimer(timer)
  }

  const handleClick = () => {
    void notifications?.markAllAsSeen()
    if (isMobile) {
      router.push('/notifications/inbox')
      return
    }
    if (open) {
      closeDrawer()
      return
    }
    if (closeTimer !== null) window.clearTimeout(closeTimer)
    setDrawerMounted(true)
    requestAnimationFrame(() => setOpen(true))
  }

  return (
    <div className="relative">
      <button type="button" onClick={handleClick} aria-label="Notifications" aria-expanded={open} className="p-2 hover:bg-gray-100 rounded-full text-gray-600 hover:text-gray-800 transition-colors relative">
        <i className="fas fa-bell text-lg" />
        {!!notifications?.unseenCount && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[11px] font-semibold flex items-center justify-center leading-none" style={{ backgroundColor: '#239459' }}>{notifications.unseenCount > 9 ? '9+' : notifications.unseenCount}</span>}
      </button>
      {drawerMounted && !isMobile && <div className={`fixed inset-0 z-[60] bg-black/30 transition-opacity duration-200 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer() }}>
        <div className={`ml-auto h-full w-full max-w-md transform transition-transform duration-200 ease-out ${open ? 'translate-x-0' : 'translate-x-full'}`}><NotificationsPanel mode="modal" onClose={closeDrawer} /></div>
      </div>}
    </div>
  )
}
