'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Portal Root Page - Redirects to Dashboard
 * 
 * This page automatically redirects users from /portal to /portal/dashboard
 * to ensure they land on the main portal dashboard by default.
 */
export default function PortalPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to dashboard immediately when portal root is accessed
    router.replace('/portal/dashboard')
  }, [router])

  // Show loading state while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to dashboard...</p>
      </div>
    </div>
  )
}