'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from './ui/IconWrapper'
import { useAuth } from '@/hooks/useAuth'

export default function LogoutButton() {
  const router = useRouter()
  const { logout, isLoading } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
      router.refresh()
      router.replace('/signin')
    } catch {
      router.refresh()
      router.replace('/signin')
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <LogOut className="w-4 h-4 mr-3 text-red-500" />
      {isLoading ? 'Signing Out...' : 'Sign Out'}
    </button>
  )
}
