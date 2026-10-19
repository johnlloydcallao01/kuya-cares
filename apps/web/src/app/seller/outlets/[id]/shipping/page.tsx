'use client'

import ShippingZoneMap from './ShippingZoneMap'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  MapPin,
  Plus,
  Save,
  Store,
  Trash2,
  Truck,
} from 'lucide-react'
import { ClientOnly } from '@/app/seller/_components/ClientOnly'

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
  geometry: import('./ShippingZoneMap').ShippingZoneGeometry | null
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

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-[#239459] focus:outline-none focus:ring-2 focus:ring-[#239459]/20 dark:border-[#3f3f46] dark:bg-[#0a0a0a] dark:text-white'

function splitList(value: string): string[] {
  return value.split(',').map((part) => part.trim()).filter(Boolean)
}

function newArea(): ShippingArea {
  return { region: '', province: '', city: '', barangays: [], postalCodes: [] }
}

function newZone(): ShippingZone {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `zone_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    enabled: true,
    areas: [],
    geometry: null,
    deliveryFee: 0,
    minimumOrderAmount: 0,
    freeDeliveryThreshold: null,
    estimatedDeliveryMinMinutes: 0,
    estimatedDeliveryMaxMinutes: 0,
  }
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

function settingsForSave(settings: ShippingSettings): ShippingSettings {
  return {
    version: 1,
    pickup: {
      enabled: settings.pickup.enabled,
      instructions: settings.pickup.instructions?.trim() || null,
    },
    zones: settings.zones.map((zone) => ({
      id: zone.id.trim(),
      name: zone.name.trim(),
      enabled: zone.enabled,
      areas: zone.areas
        .map((area) => ({
          ...(area.region?.trim() ? { region: area.region.trim() } : {}),
          ...(area.province?.trim() ? { province: area.province.trim() } : {}),
          ...(area.city?.trim() ? { city: area.city.trim() } : {}),
          barangays: area.barangays.map((value) => value.trim()).filter(Boolean),
          postalCodes: area.postalCodes.map((value) => value.trim()).filter(Boolean),
        }))
        .filter(
          (area) =>
            area.region ||
            area.province ||
            area.city ||
            area.barangays.length > 0 ||
            area.postalCodes.length > 0,
        ),
      geometry: zone.geometry ?? null,
      deliveryFee: Number(zone.deliveryFee),
      minimumOrderAmount: Number(zone.minimumOrderAmount),
      freeDeliveryThreshold: zone.freeDeliveryThreshold == null || zone.freeDeliveryThreshold === 0
        ? null
        : Number(zone.freeDeliveryThreshold),
      estimatedDeliveryMinMinutes: Number(zone.estimatedDeliveryMinMinutes),
      estimatedDeliveryMaxMinutes: Number(zone.estimatedDeliveryMaxMinutes),
    })),
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

function ShippingSettingsEditor() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const outletId = params.id
  const [outlet, setOutlet] = useState<OutletResponse | null>(null)
  const [settings, setSettings] = useState<ShippingSettings>(structuredClone(EMPTY_SETTINGS))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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

  const updateZone = (zoneIndex: number, patch: Partial<ShippingZone>) => {
    setSettings((current) => ({
      ...current,
      zones: current.zones.map((zone, index) => index === zoneIndex ? { ...zone, ...patch } : zone),
    }))
  }

  const updateArea = (zoneIndex: number, areaIndex: number, patch: Partial<ShippingArea>) => {
    setSettings((current) => ({
      ...current,
      zones: current.zones.map((zone, index) => index !== zoneIndex ? zone : {
        ...zone,
        areas: zone.areas.map((area, index) => index === areaIndex ? { ...area, ...patch } : area),
      }),
    }))
  }

  const moveZone = (index: number, offset: number) => {
    setSettings((current) => {
      const target = index + offset
      if (target < 0 || target >= current.zones.length) return current
      const zones = [...current.zones]
      ;[zones[index], zones[target]] = [zones[target], zones[index]]
      return { ...current, zones }
    })
  }

  const canSave = useMemo(
    () => !saving && !loading && !!outlet,
    [loading, outlet, saving],
  )

  const save = async () => {
    if (!canSave) return
    const submittedSettings = settingsForSave(settings)
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save shipping settings.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="py-8 text-sm text-gray-500">Loading outlet shipping settings…</div>
  }

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
    <div className="mx-auto max-w-5xl space-y-6 py-5 px-2.5">
      <Link href={`/seller/outlets/${outletId}`} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-[#a1a1aa] dark:hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to outlet
      </Link>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <Truck className="h-6 w-6 text-[#239459]" /> Shipping settings
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-[#a1a1aa]">
            Configure delivery coverage, buyer-paid rates, and pickup for {outlet?.outletName || 'this outlet'}.
          </p>
        </div>
        <button type="button" onClick={() => void save()} disabled={!canSave} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#239459] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#215035] disabled:cursor-not-allowed disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save shipping'}
        </button>
      </header>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</div>}
      {success && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">Shipping settings saved and verified.</div>}

      <section className="rounded-xl border border-gray-200 bg-white p-5 dark:border-[#262626] dark:bg-[#171717]">
        <div className="flex items-start gap-3">
          <Store className="mt-0.5 h-5 w-5 text-[#239459]" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-900 dark:text-white">Customer pickup</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-[#a1a1aa]">Offer pickup from this outlet. Pickup has no delivery charge.</p>
            <label className="mt-4 flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
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
              <label className="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Pickup instructions
                <textarea
                  value={settings.pickup.instructions ?? ''}
                  onChange={(event) => setSettings((current) => ({
                    ...current,
                    pickup: { ...current.pickup, instructions: event.target.value || null },
                  }))}
                  maxLength={1000}
                  rows={3}
                  className={inputClass}
                  placeholder="Where should the customer go, and what should they bring?"
                />
              </label>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Delivery zones</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-[#a1a1aa]">
              Customers match the first enabled zone in this order. Put more specific coverage first.
            </p>
          </div>
          <button type="button" onClick={() => setSettings((current) => ({ ...current, zones: [...current.zones, newZone()] }))} className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#239459] px-3 py-2 text-sm font-semibold text-[#239459] hover:bg-[#239459]/5">
            <Plus className="h-4 w-4" /> Add zone
          </button>
        </div>

        {!settings.zones.length && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-[#3f3f46] dark:bg-[#171717]">
            <MapPin className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 font-medium text-gray-800 dark:text-gray-200">No delivery zones yet</p>
            <p className="mt-1 text-sm text-gray-500">Add a zone to offer seller-arranged delivery. Pickup can be enabled separately.</p>
          </div>
        )}

        {settings.zones.map((zone, zoneIndex) => (
          <article key={zone.id} className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 dark:border-[#262626] dark:bg-[#171717]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="flex flex-1 items-start gap-3">
                <div className="mt-1 rounded-full bg-[#239459]/10 px-2 py-1 text-xs font-bold text-[#239459]">#{zoneIndex + 1}</div>
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Zone name (optional)
                    <input value={zone.name} onChange={(event) => updateZone(zoneIndex, { name: event.target.value })} maxLength={100} className={inputClass} placeholder="e.g. Quezon City" />
                  </label>
                  <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <input type="checkbox" checked={zone.enabled} onChange={(event) => updateZone(zoneIndex, { enabled: event.target.checked })} className="h-4 w-4 accent-[#239459]" />
                    Zone enabled
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-1 self-end sm:self-start">
                <button type="button" onClick={() => moveZone(zoneIndex, -1)} disabled={zoneIndex === 0} aria-label="Move zone up" className="rounded-lg border border-gray-200 p-2 text-gray-600 disabled:opacity-30 dark:border-[#3f3f46] dark:text-gray-300"><ArrowUp className="h-4 w-4" /></button>
                <button type="button" onClick={() => moveZone(zoneIndex, 1)} disabled={zoneIndex === settings.zones.length - 1} aria-label="Move zone down" className="rounded-lg border border-gray-200 p-2 text-gray-600 disabled:opacity-30 dark:border-[#3f3f46] dark:text-gray-300"><ArrowDown className="h-4 w-4" /></button>
                <button type="button" onClick={() => setSettings((current) => ({ ...current, zones: current.zones.filter((_, index) => index !== zoneIndex) }))} aria-label="Remove zone" className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="space-y-3 border-t border-gray-100 pt-4 dark:border-[#262626]">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Map boundary</h3>
                <p className="text-xs text-gray-500">
                  Draw a delivery boundary for this fee. Buyers match this zone if their saved
                  address point is inside it or their address matches one of the coverage areas.
                </p>
              </div>
              <ShippingZoneMap
                value={zone.geometry ?? null}
                onChange={(geometry) => updateZone(zoneIndex, { geometry })}
              />
            </div>

            <div className="space-y-3 border-t border-gray-100 pt-4 dark:border-[#262626]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Coverage areas</h3>
                  <p className="text-xs text-gray-500">Every filled field in an area must match. Lists accept comma-separated values.</p>
                </div>
                <button type="button" onClick={() => updateZone(zoneIndex, { areas: [...zone.areas, newArea()] })} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-[#3f3f46] dark:text-gray-200 dark:hover:bg-[#262626]">
                  <Plus className="h-3.5 w-3.5" /> Add area
                </button>
              </div>
              {zone.areas.map((area, areaIndex) => (
                <div key={`${zone.id}-area-${areaIndex}`} className="rounded-lg border border-gray-100 p-3 dark:border-[#262626]">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Area {areaIndex + 1}</span>
                    {zone.areas.length > 1 && (
                      <button type="button" onClick={() => updateZone(zoneIndex, { areas: zone.areas.filter((_, index) => index !== areaIndex) })} className="text-xs font-medium text-red-600">Remove area</button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Region
                      <input value={area.region ?? ''} onChange={(event) => updateArea(zoneIndex, areaIndex, { region: event.target.value })} maxLength={120} className={inputClass} placeholder="NCR" />
                    </label>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Province
                      <input value={area.province ?? ''} onChange={(event) => updateArea(zoneIndex, areaIndex, { province: event.target.value })} maxLength={120} className={inputClass} placeholder="Metro Manila" />
                    </label>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">City / locality
                      <input value={area.city ?? ''} onChange={(event) => updateArea(zoneIndex, areaIndex, { city: event.target.value })} maxLength={120} className={inputClass} placeholder="Quezon City" />
                    </label>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Barangays
                      <input value={area.barangays.join(', ')} onChange={(event) => updateArea(zoneIndex, areaIndex, { barangays: splitList(event.target.value) })} maxLength={1200} className={inputClass} placeholder="Commonwealth, Batasan Hills" />
                    </label>
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Postal codes
                      <input value={area.postalCodes.join(', ')} onChange={(event) => updateArea(zoneIndex, areaIndex, { postalCodes: splitList(event.target.value) })} maxLength={2400} className={inputClass} placeholder="1121, 1122" />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-[#262626]">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Delivery fee (PHP)
                <input type="number" min="0" step="0.01" value={zone.deliveryFee} onChange={(event) => updateZone(zoneIndex, { deliveryFee: Number(event.target.value) })} className={inputClass} />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Minimum order (PHP)
                <input type="number" min="0" step="0.01" value={zone.minimumOrderAmount} onChange={(event) => updateZone(zoneIndex, { minimumOrderAmount: Number(event.target.value) })} className={inputClass} />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Free delivery from (PHP)
                <input type="number" min="0" step="0.01" value={zone.freeDeliveryThreshold ?? ''} onChange={(event) => updateZone(zoneIndex, { freeDeliveryThreshold: event.target.value === '' ? null : Number(event.target.value) })} className={inputClass} placeholder="Leave blank to disable" />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Delivery estimate minimum (minutes)
                <input type="number" min="0" step="1" value={zone.estimatedDeliveryMinMinutes} onChange={(event) => updateZone(zoneIndex, { estimatedDeliveryMinMinutes: Number(event.target.value) })} className={inputClass} />
              </label>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Delivery estimate maximum (minutes)
                <input type="number" min="0" step="1" value={zone.estimatedDeliveryMaxMinutes} onChange={(event) => updateZone(zoneIndex, { estimatedDeliveryMaxMinutes: Number(event.target.value) })} className={inputClass} />
              </label>
            </div>
          </article>
        ))}
      </section>

      <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-[#262626] dark:bg-[#171717]/95">
        <p className="hidden text-xs text-gray-500 sm:block">Shipping fees go to your seller payout. Your delivery arrangement is your responsibility.</p>
        <button type="button" onClick={() => void save()} disabled={!canSave} className="ml-auto inline-flex items-center justify-center gap-2 rounded-lg bg-[#239459] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#215035] disabled:cursor-not-allowed disabled:opacity-50">
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save shipping'}
        </button>
      </div>
    </div>
  )
}

export default function SellerOutletShippingPage() {
  return (
    <ClientOnly fallback={<div className="py-8 text-sm text-gray-500">Loading shipping settings…</div>}>
      <ShippingSettingsEditor />
    </ClientOnly>
  )
}
