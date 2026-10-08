'use client'

import { useEffect, useState } from 'react'

type VendorProfile = { id: number | string; businessName?: string }

export function VendorProfileSelect({
  value,
  onChange,
}: {
  value: string
  onChange: (vendorId: string) => void
}) {
  const [profiles, setProfiles] = useState<VendorProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      try {
        const response = await fetch('/api/seller-business/profile', { cache: 'no-store' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Failed to load vendor profiles')
        const rows = Array.isArray(data.vendors) ? data.vendors as VendorProfile[] : data.vendor ? [data.vendor as VendorProfile] : []
        if (!cancelled) {
          setProfiles(rows)
          const requested = new URLSearchParams(window.location.search).get('vendorId')
          const saved = window.localStorage.getItem('seller-coupons-vendor-id')
          const selected = rows.find((profile) => String(profile.id) === requested)
            ?? rows.find((profile) => String(profile.id) === saved)
          if (!value) onChange(String(selected?.id ?? rows[0]?.id ?? ''))
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Failed to load vendor profiles')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [onChange, value])

  useEffect(() => {
    if (value) window.localStorage.setItem('seller-coupons-vendor-id', value)
  }, [value])

  if (loading) return <div className="h-10 w-full sm:w-72 animate-pulse rounded-lg bg-gray-100 dark:bg-[#171717]" />
  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>
  if (profiles.length === 0) return <p className="text-sm text-gray-500 dark:text-[#a1a1aa]">No vendor profiles found.</p>
  if (profiles.length === 1) return null

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-gray-600 dark:text-[#a1a1aa]">
      Vendor profile
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-[#262626] dark:bg-[#171717] dark:text-white sm:w-72"
      >
        {profiles.map((profile) => (
          <option key={profile.id} value={String(profile.id)}>
            {profile.businessName || `Vendor #${profile.id}`}
          </option>
        ))}
      </select>
    </label>
  )
}

export function withVendorId(path: string, vendorId: string) {
  return `${path}${path.includes('?') ? '&' : '?'}vendorId=${encodeURIComponent(vendorId)}`
}
