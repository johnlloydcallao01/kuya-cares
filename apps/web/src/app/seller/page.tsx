'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SellerRootPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/seller/dashboard/overview')
  }, [router])

  return null
}
