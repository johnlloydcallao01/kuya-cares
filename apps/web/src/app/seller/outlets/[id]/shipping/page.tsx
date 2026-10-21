'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  MapPin,
  Pencil,
  Plus,
  Save,
  Store,
  Trash2,
  Truck,
} from 'lucide-react'
import { ClientOnly } from '@/app/seller/_components/ClientOnly'
import { ShippingZoneEditorSkeleton } from './_components/ShippingZoneEditor'

type ShippingArea = {
  region?: string
  province?: string
  city?: string
  barangays: string[]
  postalCodes: string[]
}

type ShippingZone = {
  id: string
  name: string
  enabled: boolean
  areas: ShippingArea[]
  geometry: { type: string } | null
  deliveryFee: number
  minimumOrderAmount: number
  freeDeliveryThreshold: number | null
  estimatedDeliveryMinMinutes: number
  estimatedDeliveryMaxMinutes: number
}

type ShippingSettings = {
  version: 1
  pickup: { enabled: boolean; instructions: string | null }
  zones: ShippingZone[]
}

type OutletResponse = {
  id: string | number
  outletName: string
  sellerShippingSettings?: ShippingSettings | null
}

const EMPTY_SETTINGS: ShippingSettings = {
  version: 1,
  pickup: { enabled: false, instructions: null },
  zones: [],
}

function normalizeSettings(value: ShippingSettings | null | undefined): ShippingSettings {
  if (!value || typeof value !== 'object') return structuredClone(EMPTY_SETTINGS)
  return {
    version: 1,
    pickup: {
      enabled: value.pickup?.enabled === true,
      instructions: value.pickup?.instructions ?? null,
    },
    zones: Array.isArray(value.zones)
      ? value.zones.map((zone) => ({
          ...zone,
          areas: Array.isArray(zone.areas)
            ? zone.areas.map((area) => ({
                ...area,
                barangays: Array.isArray(area.barangays) ? area.barangays : [],
                postalCodes: Array.isArray(area.postalCodes) ? area.postalCodes : [],
              }))
            : [],
          geometry: zone.geometry ?? null,
        }))
      : [],
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function money(value: number): string {
  return `₱${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function coverageSummary(zone: ShippingZone): string {
  const areas = zone.areas
    .map((area) => [area.city, area.province, area.region].filter(Boolean).join(', '))
    .filter(Boolean)
  if (areas.length) return areas.slice(0, 2).join(' · ') + (areas.length > 2 ? ` +${areas.length - 2}` : '')
  if (zone.geometry) return 'Drawn map boundary'
  return 'Coverage not defined'
}

function ShippingZonesPageContent() {
  const params = useParams<{ id: string }>()
  const outletId = params.id
  const [outlet, setOutlet] = useState<OutletResponse | null>(null)
  const [settings, setSettings] = useState<ShippingSettings>(structuredClone(EMPTY_SETTINGS))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [deletingZone, setDeletingZone] = useState<ShippingZone | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/seller-outlets/${encodeURIComponent(outletId)}?_t=${Date.now()}`, {
        cache: 'no-store',
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to load outlet shipping settings.')
      const doc = (result.outlet ?? result.doc) as OutletResponse | undefined
      if (!doc) throw new Error('The requested outlet was not returned by the server.')
      setOutlet(doc)
      setSettings(normalizeSettings(doc.sellerShippingSettings))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load outlet shipping settings.')
    } finally {
      setLoading(false)
    }
  }, [outletId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!deletingZone) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        setDeletingZone(null)
        setDeleteError(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [deletingZone, saving])

  const persist = async (nextSettings: ShippingSettings, reportError = true): Promise<string | null> => {
    const submittedSettings: ShippingSettings = {
      ...nextSettings,
      pickup: {
        enabled: nextSettings.pickup.enabled,
        instructions: nextSettings.pickup.instructions?.trim() || null,
      },
    }
    setSaving(true)
    setError(null)
    setSuccess(false)
    try {
      const response = await fetch(`/api/seller-outlets/${encodeURIComponent(outletId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sellerShippingSettings: submittedSettings }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to save shipping settings.')

      const verifyResponse = await fetch(`/api/seller-outlets/${encodeURIComponent(outletId)}?_t=${Date.now()}`, {
        cache: 'no-store',
      })
      const verified = await verifyResponse.json()
      if (!verifyResponse.ok) throw new Error(verified.error || 'Shipping was saved, but could not be verified.')
      const doc = (verified.outlet ?? verified.doc) as OutletResponse | undefined
      if (!doc) throw new Error('Shipping was saved, but the server returned no outlet to verify.')
      const persisted = normalizeSettings(doc.sellerShippingSettings)
      if (stableStringify(persisted) !== stableStringify(submittedSettings)) {
        throw new Error('Shipping save verification failed. The persisted settings differ from the values submitted.')
      }
      setOutlet(doc)
      setSettings(persisted)
      setSuccess(true)
      return null
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to save shipping settings.'
      if (reportError) setError(message)
      return message
    } finally {
      setSaving(false)
    }
  }

  const reorderZone = (index: number, offset: number) => {
    const destination = index + offset
    if (destination < 0 || destination >= settings.zones.length || saving) return
    const zones = [...settings.zones]
    ;[zones[index], zones[destination]] = [zones[destination], zones[index]]
    void persist({ ...settings, zones })
  }

  const deleteZone = (zone: ShippingZone) => {
    if (saving) return
    setDeleteError(null)
    setDeletingZone(zone)
  }

  const confirmDeleteZone = async () => {
    if (!deletingZone || saving) return
    const message = await persist(
      { ...settings, zones: settings.zones.filter((item) => item.id !== deletingZone.id) },
      false,
    )
    if (message) {
      setDeleteError(message)
    } else {
      setDeletingZone(null)
    }
  }

  if (loading) return <ShippingZoneEditorSkeleton />

  if (error && !outlet) {
    return (
      <div className="space-y-4 py-6">
        <Link href="/seller/outlets" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 dark:text-[#a1a1aa] dark:hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to outlets
        </Link>
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</div>
        <button type="button" onClick={() => void load()} className="rounded-lg bg-[#239459] px-4 py-2 text-sm font-semibold text-white">Retry</button>
      </div>
    )
  }

  return (
    <div className="space-y-6 py-5 px-2.5">
      <Link href={`/seller/outlets/${outletId}`} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-[#a1a1aa] dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to outlet
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#239459] text-white"><Truck className="h-4 w-4" /></span>
            Shipping zones
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#a1a1aa]">
            Manage delivery areas and buyer-paid rates for {outlet?.outletName || 'this outlet'}.
          </p>
        </div>
        <Link href={`/seller/outlets/${encodeURIComponent(outletId)}/shipping/new`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#239459] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#215035]">
          <Plus className="h-4 w-4" /> Create shipping zone
        </Link>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</div>}
      {success && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200"><Check className="h-4 w-4" /> Shipping settings saved and verified.</div>}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#262626] dark:bg-[#171717]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <Store className="mt-0.5 h-5 w-5 shrink-0 text-[#239459]" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900 dark:text-white">Customer pickup</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-[#a1a1aa]">Offer pickup from this outlet. Pickup has no delivery charge.</p>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
              <label className="flex items-center gap-2 pt-2 text-sm font-medium text-gray-800 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={settings.pickup.enabled}
                  onChange={(event) => setSettings((current) => ({
                    ...current,
                    pickup: { ...current.pickup, enabled: event.target.checked },
                  }))}
                  className="h-4 w-4 accent-[#239459]"
                />
                Enable pickup
              </label>
              {settings.pickup.enabled && (
                <textarea
                  value={settings.pickup.instructions ?? ''}
                  onChange={(event) => setSettings((current) => ({
                    ...current,
                    pickup: { ...current.pickup, instructions: event.target.value || null },
                  }))}
                  maxLength={1000}
                  rows={2}
                  aria-label="Pickup instructions"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#239459] focus:outline-none focus:ring-2 focus:ring-[#239459]/20 dark:border-[#3f3f46] dark:bg-[#0a0a0a] dark:text-white sm:max-w-lg"
                  placeholder="Pickup instructions for customers"
                />
              )}
              <button
                type="button"
                onClick={() => void persist(settings)}
                disabled={saving}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#239459] px-3 py-2 text-sm font-semibold text-[#239459] hover:bg-[#239459]/5 disabled:opacity-50 sm:ml-auto"
              >
                <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save pickup'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-[#262626] dark:bg-[#171717]">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-[#262626]">
          <div>
            <h2 className="font-semibold text-gray-900 dark:text-white">Delivery rates</h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-[#a1a1aa]">Customers match the first enabled zone. Order the most specific coverage first.</p>
          </div>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-[#262626] dark:text-[#a1a1aa]">{settings.zones.length} zones</span>
        </div>

        {!settings.zones.length ? (
          <div className="px-4 py-12 text-center">
            <MapPin className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 font-medium text-gray-800 dark:text-gray-200">No delivery zones yet</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-[#a1a1aa]">Create a zone to set where you deliver and how much delivery costs.</p>
            <Link href={`/seller/outlets/${encodeURIComponent(outletId)}/shipping/new`} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#239459] px-4 py-2 text-sm font-semibold text-white">
              <Plus className="h-4 w-4" /> Create shipping zone
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 dark:border-[#262626] dark:bg-[#0a0a0a] dark:text-[#a1a1aa]">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Zone</th>
                  <th className="px-4 py-3 text-left font-semibold">Coverage</th>
                  <th className="px-4 py-3 text-right font-semibold">Delivery fee</th>
                  <th className="px-4 py-3 text-right font-semibold">Minimum / free delivery</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#262626]">
                {settings.zones.map((zone, index) => (
                  <tr key={zone.id} className="text-gray-700 dark:text-gray-200">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex flex-col">
                          <button type="button" onClick={() => reorderZone(index, -1)} disabled={index === 0 || saving} aria-label={`Move ${zone.name || 'zone'} up`} className="text-gray-400 hover:text-[#239459] disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                          <button type="button" onClick={() => reorderZone(index, 1)} disabled={index === settings.zones.length - 1 || saving} aria-label={`Move ${zone.name || 'zone'} down`} className="text-gray-400 hover:text-[#239459] disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                        </span>
                        <span>
                          <span className="block font-semibold text-gray-900 dark:text-white">{zone.name.trim() || 'Seller delivery'}</span>
                          <span className="text-xs text-gray-500 dark:text-[#a1a1aa]">Priority {index + 1}</span>
                        </span>
                      </div>
                    </td>
                    <td className="min-w-[180px] px-4 py-3 text-xs text-gray-600 dark:text-[#a1a1aa]">
                      <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 shrink-0" />{coverageSummary(zone)}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium">{money(zone.deliveryFee)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs">
                      <div>{money(zone.minimumOrderAmount)}</div>
                      <div className="text-gray-500 dark:text-[#a1a1aa]">{zone.freeDeliveryThreshold == null ? 'No free delivery' : `Free from ${money(zone.freeDeliveryThreshold)}`}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${zone.enabled ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300' : 'border-gray-200 bg-gray-100 text-gray-600 dark:border-[#3f3f46] dark:bg-[#262626] dark:text-[#a1a1aa]'}`}>
                        {zone.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Link href={`/seller/outlets/${encodeURIComponent(outletId)}/shipping/${encodeURIComponent(zone.id)}/edit`} aria-label={`Edit ${zone.name || 'shipping zone'}`} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:border-[#239459] hover:text-[#239459] dark:border-[#3f3f46] dark:text-gray-200">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Link>
                        <button type="button" onClick={() => deleteZone(zone)} disabled={saving} aria-label={`Delete ${zone.name || 'shipping zone'}`} className="rounded-lg border border-red-200 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/30">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs text-gray-500 dark:text-[#a1a1aa]">Shipping fees go to your seller payout. Your delivery arrangement is your responsibility.</p>

      {deletingZone && typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => {
              if (!saving) {
                setDeletingZone(null)
                setDeleteError(null)
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-shipping-zone-title"
              className="relative w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-[#262626] dark:bg-[#171717]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <h2 id="delete-shipping-zone-title" className="font-bold text-gray-900 dark:text-white">Delete shipping zone?</h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-[#a1a1aa]">
                This will permanently delete <span className="font-semibold text-gray-900 dark:text-white">{deletingZone.name || 'Seller delivery'}</span>. This action cannot be undone.
              </p>
              {deleteError && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{deleteError}</p>}
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeletingZone(null)
                    setDeleteError(null)
                  }}
                  disabled={saving}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#262626] dark:bg-[#171717] dark:hover:bg-[#262626]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeleteZone()}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Deleting…' : 'Confirm delete'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

export default function SellerOutletShippingPage() {
  return (
    <ClientOnly fallback={<ShippingZoneEditorSkeleton />}>
      <ShippingZonesPageContent />
    </ClientOnly>
  )
}
