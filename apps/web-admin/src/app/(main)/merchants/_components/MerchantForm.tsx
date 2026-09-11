'use client'

import React, { useEffect, useState } from 'react'
import { Building, Mail, Store, ShieldCheck, AlertCircle, RefreshCw, Phone, MapPin, Clock, Tag, Image as ImageIcon, Truck, DollarSign } from '@/components/ui/IconWrapper'
import { MediaUploader } from '@/components/cms/MediaUploader'

const OPERATIONAL_OPTS = [
  { value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' },
  { value: 'busy', label: 'Busy' }, { value: 'temp_closed', label: 'Temp Closed' },
  { value: 'maintenance', label: 'Maintenance' },
]
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const
const TIMEZONES = ['Asia/Manila', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'UTC']

type MerchantDoc = {
  id: number
  outletName: string
  outletCode: string
  vendor: number | { id: number; businessName: string }
  contactInfo?: { phone?: string; email?: string; managerName?: string; managerPhone?: string } | null
  isActive?: boolean
  isAcceptingOrders?: boolean
  is_currently_delivering?: boolean
  operationalStatus?: string
  timezone?: string
  description?: string | null
  specialInstructions?: string | null
  tags?: string[] | null
  merchant_categories?: any[]
  activeAddress?: any
  operatingHours?: any
  specialHours?: any
  deliverySettings?: any
  delivery_hours?: any
  deliveryHours?: any
  merchant_latitude?: number | null
  merchant_longitude?: number | null
  location_accuracy_radius?: number | null
  delivery_radius_meters?: number | null
  max_delivery_radius_meters?: number | null
  min_order_amount?: number | null
  delivery_fee_base?: number | null
  delivery_fee_per_km?: number | null
  free_delivery_threshold?: number | null
  avg_delivery_time_minutes?: number | null
  delivery_success_rate?: number | null
  peak_hours_multiplier?: number | null
  next_available_slot?: string | null
  service_area?: any
  priority_zones?: any
  restricted_areas?: any
  delivery_zones?: any
  media?: { thumbnail?: any; storeFrontImage?: any; interiorImages?: any; menuImages?: any }
}

function buildHours(src: unknown): Record<string, { open: string; close: string; closed: boolean; periods?: { open: string; close: string }[] }> {
  const out: Record<string, { open: string; close: string; closed: boolean; periods?: { open: string; close: string }[] }> = {}
  const s = src && typeof src === 'object' && !Array.isArray(src) ? (src as Record<string, unknown>) : {}
  for (const day of DAYS) {
    const key = day.toLowerCase()
    const v = s[key] as { open?: string; close?: string; closed?: boolean } | undefined
    // also support capitalized key
    const v2 = s[day] as { open?: string; close?: string; closed?: boolean } | undefined
    const cur = v ?? v2
    const period = Array.isArray(cur) ? cur[0] : cur
    out[day] = period && typeof period === 'object' ? { open: (period as any).open || '09:00', close: (period as any).close || '21:00', closed: !!(period as any).closed, ...(Array.isArray(cur) ? { periods: cur } : {}) } : { open: '09:00', close: '21:00', closed: false }
  }
  return out
}
function toJsonText(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return JSON.stringify(p, null, 2) } catch { return v }
  }
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}
function parseJsonInput(text: string, fallback: any = null): any {
  const t = text.trim()
  if (!t) return fallback
  return JSON.parse(t)
}
function extractMediaIds(raw: unknown): (string | number)[] {
  if (!raw) return []
  if (Array.isArray(raw)) {
    return raw.map((x: any) => {
      if (x == null) return null
      if (typeof x === 'object' && 'id' in x) return (x as any).id
      return x
    }).filter((x: any) => x !== null && x !== '' ).map((x:any)=> x)
  }
  // single value
  if (typeof raw === 'object' && raw !== null && 'id' in (raw as any)) return [(raw as any).id]
  return [raw as any]
}
function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2,'0')
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return '' }
}

export function MerchantForm({ initial, onSuccess, onCancel }: { initial?: MerchantDoc | null; onSuccess: () => void; onCancel: () => void }) {
  const isEdit = !!initial
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vendors, setVendors] = useState<{ id: number; businessName: string }[]>([])
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([])
  const [thumbnailId, setThumbnailId] = useState<string | number | undefined>((initial?.media as any)?.thumbnail?.id || (initial as any)?.thumbnail)
  const [storeFrontImageId, setStoreFrontImageId] = useState<string | number | undefined>((initial?.media as any)?.storeFrontImage?.id || (initial as any)?.storeFrontImage)
  const [interiorIds, setInteriorIds] = useState<(string|number)[]>(() => extractMediaIds((initial?.media as any)?.interiorImages ?? (initial as any)?.interiorImages))
  const [menuIds, setMenuIds] = useState<(string|number)[]>(() => extractMediaIds((initial?.media as any)?.menuImages ?? (initial as any)?.menuImages))

  const initialHours = buildHours(initial?.operatingHours)
  const [form, setForm] = useState({
    vendor: initial?.vendor ? String(typeof initial.vendor === 'object' ? (initial.vendor as any).id : initial.vendor) : '',
    outletName: initial?.outletName || '',
    outletCode: initial?.outletCode || '',
    contactPhone: initial?.contactInfo?.phone || '',
    contactEmail: initial?.contactInfo?.email || '',
    managerName: initial?.contactInfo?.managerName || '',
    managerPhone: initial?.contactInfo?.managerPhone || '',
    isActive: initial?.isActive ?? true,
    isAcceptingOrders: initial?.isAcceptingOrders ?? true,
    isCurrentlyDelivering: (initial as any)?.is_currently_delivering ?? true,
    operationalStatus: initial?.operationalStatus || 'open',
    timezone: initial?.timezone || 'Asia/Manila',
    description: initial?.description || '',
    specialInstructions: (initial as any)?.specialInstructions || '',
    tagsText: Array.isArray(initial?.tags) ? (initial?.tags as string[]).join(', ') : (typeof initial?.tags === 'string' ? initial.tags : ''),
    merchantCategoryIds: Array.isArray(initial?.merchant_categories) ? initial.merchant_categories.map((c:any)=> typeof c==='object' ? String(c.id) : String(c)) : [],
    activeAddress: initial?.activeAddress ? String(typeof initial.activeAddress==='object' ? (initial.activeAddress as any).id : initial.activeAddress) : '',
    merchantLatitude: initial?.merchant_latitude != null ? String(initial.merchant_latitude) : '',
    merchantLongitude: initial?.merchant_longitude != null ? String(initial.merchant_longitude) : '',
    locationAccuracyRadius: (initial as any)?.location_accuracy_radius != null ? String((initial as any).location_accuracy_radius) : '',
    // deliverySettings group
    minimumOrderAmount: String(initial?.deliverySettings?.minimumOrderAmount ?? 0),
    deliveryFee: String(initial?.deliverySettings?.deliveryFee ?? 0),
    freeDeliveryThresholdGroup: initial?.deliverySettings?.freeDeliveryThreshold != null ? String(initial.deliverySettings.freeDeliveryThreshold) : '',
    estimatedDeliveryTimeMinutes: String(initial?.deliverySettings?.estimatedDeliveryTimeMinutes ?? 30),
    maxDeliveryTimeMinutes: String(initial?.deliverySettings?.maxDeliveryTimeMinutes ?? 60),
    // top-level radii/fees
    deliveryRadiusMeters: initial?.delivery_radius_meters != null ? String(initial.delivery_radius_meters) : (initial?.deliverySettings?.deliveryRadiusMeters != null ? String(initial.deliverySettings.deliveryRadiusMeters) : '5000'),
    maxDeliveryRadiusMeters: initial?.max_delivery_radius_meters != null ? String(initial.max_delivery_radius_meters) : (initial?.deliverySettings?.maxDeliveryRadiusMeters != null ? String(initial.deliverySettings.maxDeliveryRadiusMeters) : '10000'),
    minOrderAmountTop: initial?.min_order_amount != null ? String(initial.min_order_amount) : '',
    deliveryFeeBase: initial?.delivery_fee_base != null ? String(initial.delivery_fee_base) : '',
    deliveryFeePerKm: initial?.delivery_fee_per_km != null ? String(initial.delivery_fee_per_km) : (initial?.deliverySettings?.deliveryFeePerKm != null ? String(initial.deliverySettings.deliveryFeePerKm) : '0'),
    freeDeliveryThresholdTop: initial?.free_delivery_threshold != null ? String(initial.free_delivery_threshold) : '',
    avgDeliveryTimeMinutes: (initial as any)?.avg_delivery_time_minutes != null ? String((initial as any).avg_delivery_time_minutes) : '',
    deliverySuccessRate: (initial as any)?.delivery_success_rate != null ? String((initial as any).delivery_success_rate) : '',
    peakHoursMultiplier: (initial as any)?.peak_hours_multiplier != null ? String((initial as any).peak_hours_multiplier) : '1',
    hours: initialHours,
    specialHoursText: toJsonText(initial?.specialHours),
    deliveryHoursText: toJsonText(initial?.delivery_hours ?? initial?.deliveryHours ?? (initial as any)?.delivery_hours),
    nextAvailableSlot: isoToLocal((initial as any)?.next_available_slot),
    serviceAreaText: toJsonText((initial as any)?.service_area),
    priorityZonesText: toJsonText((initial as any)?.priority_zones),
    restrictedAreasText: toJsonText((initial as any)?.restricted_areas),
    deliveryZonesText: toJsonText((initial as any)?.delivery_zones),
  })
  const set = (k: string, v: any) => setForm(p => ({ ...p, [k]: v }))
  const setDay = (day: string, key: string, v: string | boolean) =>
    setForm(prev => {
      const current = prev.hours[day] || { open: '09:00', close: '21:00', closed: false }
      const periods = current.periods || [{ open: current.open, close: current.close }]
      const next = { ...current, [key]: v, periods: key === 'closed' ? periods : periods.map((period, index) => index === 0 ? { ...period, [key]: v } : period) }
      return { ...prev, hours: { ...prev.hours, [day]: next } }
    })
  const addPeriod = (day: string) => setForm(prev => {
    const current = prev.hours[day] || { open: '09:00', close: '21:00', closed: false }
    return { ...prev, hours: { ...prev.hours, [day]: { ...current, closed: false, periods: [...(current.periods || [{ open: current.open, close: current.close }]), { open: '17:00', close: '21:00' }] } } }
  })
  const removePeriod = (day: string, index: number) => setForm(prev => {
    const current = prev.hours[day]
    if (!current?.periods || current.periods.length <= 1) return prev
    const periods = current.periods.filter((_, periodIndex) => periodIndex !== index)
    return { ...prev, hours: { ...prev.hours, [day]: { ...current, open: periods[0].open, close: periods[0].close, periods } } }
  })

  useEffect(() => {
    fetch('/api/vendors?limit=100', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        const docs = j.docs || j.data || []
        setVendors(docs.map((d: any) => ({ id: d.id, businessName: d.businessName || `Vendor #${d.id}` })))
      })
      .catch(() => {})
    fetch('/api/merchant-categories?limit=100', { cache: 'no-store' })
      .then(r => r.json())
      .then(j => {
        const docs = j.docs || j.data || j.categories || j.items || []
        // handle paginated shape where docs is array of merchant-categories
        const arr = Array.isArray(docs) ? docs : Array.isArray(j) ? j : []
        setCategories(arr.map((d:any)=> ({ id: Number(d.id), name: d.name || `Category #${d.id}` })))
      })
      .catch(()=>{})
  }, [])

  useEffect(() => {
    if (!initial) return
    setForm({
      vendor: initial.vendor ? String(typeof initial.vendor === 'object' ? (initial.vendor as any).id : initial.vendor) : '',
      outletName: initial.outletName || '',
      outletCode: initial.outletCode || '',
      contactPhone: initial.contactInfo?.phone || '',
      contactEmail: initial.contactInfo?.email || '',
      managerName: initial.contactInfo?.managerName || '',
      managerPhone: initial.contactInfo?.managerPhone || '',
      isActive: initial.isActive ?? true,
      isAcceptingOrders: initial.isAcceptingOrders ?? true,
      isCurrentlyDelivering: (initial as any)?.is_currently_delivering ?? true,
      operationalStatus: initial.operationalStatus || 'open',
      timezone: initial.timezone || 'Asia/Manila',
      description: initial.description || '',
      specialInstructions: (initial as any)?.specialInstructions || '',
      tagsText: Array.isArray(initial.tags) ? (initial.tags as string[]).join(', ') : (typeof initial.tags === 'string' ? initial.tags : ''),
      merchantCategoryIds: Array.isArray(initial.merchant_categories) ? initial.merchant_categories.map((c:any)=> typeof c==='object' ? String(c.id) : String(c)) : [],
      activeAddress: initial.activeAddress ? String(typeof initial.activeAddress==='object' ? (initial.activeAddress as any).id : initial.activeAddress) : '',
      merchantLatitude: initial.merchant_latitude != null ? String(initial.merchant_latitude) : '',
      merchantLongitude: initial.merchant_longitude != null ? String(initial.merchant_longitude) : '',
      locationAccuracyRadius: (initial as any)?.location_accuracy_radius != null ? String((initial as any).location_accuracy_radius) : '',
      minimumOrderAmount: String(initial.deliverySettings?.minimumOrderAmount ?? 0),
      deliveryFee: String(initial.deliverySettings?.deliveryFee ?? 0),
      freeDeliveryThresholdGroup: initial.deliverySettings?.freeDeliveryThreshold != null ? String(initial.deliverySettings.freeDeliveryThreshold) : '',
      estimatedDeliveryTimeMinutes: String(initial.deliverySettings?.estimatedDeliveryTimeMinutes ?? 30),
      maxDeliveryTimeMinutes: String(initial.deliverySettings?.maxDeliveryTimeMinutes ?? 60),
      deliveryRadiusMeters: initial.delivery_radius_meters != null ? String(initial.delivery_radius_meters) : (initial.deliverySettings?.deliveryRadiusMeters != null ? String(initial.deliverySettings.deliveryRadiusMeters) : '5000'),
      maxDeliveryRadiusMeters: initial.max_delivery_radius_meters != null ? String(initial.max_delivery_radius_meters) : (initial.deliverySettings?.maxDeliveryRadiusMeters != null ? String(initial.deliverySettings.maxDeliveryRadiusMeters) : '10000'),
      minOrderAmountTop: initial.min_order_amount != null ? String(initial.min_order_amount) : '',
      deliveryFeeBase: initial.delivery_fee_base != null ? String(initial.delivery_fee_base) : '',
      deliveryFeePerKm: initial.delivery_fee_per_km != null ? String(initial.delivery_fee_per_km) : (initial.deliverySettings?.deliveryFeePerKm != null ? String(initial.deliverySettings.deliveryFeePerKm) : '0'),
      freeDeliveryThresholdTop: initial.free_delivery_threshold != null ? String(initial.free_delivery_threshold) : '',
      avgDeliveryTimeMinutes: (initial as any)?.avg_delivery_time_minutes != null ? String((initial as any).avg_delivery_time_minutes) : '',
      deliverySuccessRate: (initial as any)?.delivery_success_rate != null ? String((initial as any).delivery_success_rate) : '',
      peakHoursMultiplier: (initial as any)?.peak_hours_multiplier != null ? String((initial as any).peak_hours_multiplier) : '1',
      hours: buildHours(initial.operatingHours),
      specialHoursText: toJsonText(initial.specialHours),
      deliveryHoursText: toJsonText(initial.delivery_hours ?? initial.deliveryHours ?? (initial as any)?.delivery_hours),
      nextAvailableSlot: isoToLocal((initial as any)?.next_available_slot),
      serviceAreaText: toJsonText((initial as any)?.service_area),
      priorityZonesText: toJsonText((initial as any)?.priority_zones),
      restrictedAreasText: toJsonText((initial as any)?.restricted_areas),
      deliveryZonesText: toJsonText((initial as any)?.delivery_zones),
    })
    setThumbnailId((initial?.media as any)?.thumbnail?.id || (initial as any)?.thumbnail)
    setStoreFrontImageId((initial?.media as any)?.storeFrontImage?.id || (initial as any)?.storeFrontImage)
    setInteriorIds(extractMediaIds((initial?.media as any)?.interiorImages ?? (initial as any)?.interiorImages))
    setMenuIds(extractMediaIds((initial?.media as any)?.menuImages ?? (initial as any)?.menuImages))
    setError(null)
  }, [initial])

  const toggleCategory = (id: string) => {
    setForm(p => {
      const exists = p.merchantCategoryIds.includes(id)
      return { ...p, merchantCategoryIds: exists ? p.merchantCategoryIds.filter(x=>x!==id) : [...p.merchantCategoryIds, id] }
    })
  }

  const submit = async () => {
    setError(null)
    if (!form.vendor) return setError('Vendor is required')
    if (!form.outletName.trim() || form.outletName.trim().length < 2) return setError('Outlet name is required (min 2 chars)')
    if (form.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail.trim())) return setError('Contact email must be valid')
    try { Intl.DateTimeFormat(undefined, { timeZone: form.timezone }) } catch { return setError('Timezone must be valid IANA (e.g. Asia/Manila)') }
    const latNum = form.merchantLatitude.trim() ? parseFloat(form.merchantLatitude) : null
    const lngNum = form.merchantLongitude.trim() ? parseFloat(form.merchantLongitude) : null
    if (form.merchantLatitude.trim() && (latNum===null || Number.isNaN(latNum) || latNum < -90 || latNum > 90)) return setError('Latitude must be between -90 and 90')
    if (form.merchantLongitude.trim() && (lngNum===null || Number.isNaN(lngNum) || lngNum < -180 || lngNum > 180)) return setError('Longitude must be between -180 and 180')
    if (form.deliverySuccessRate.trim()) {
      const n = Number(form.deliverySuccessRate)
      if (Number.isNaN(n) || n < 0 || n > 1) return setError('Delivery success rate must be between 0 and 1')
    }
    if (form.peakHoursMultiplier.trim()) {
      const n = Number(form.peakHoursMultiplier)
      if (Number.isNaN(n) || n < 1) return setError('Peak hours multiplier must be >= 1')
    }
    let specialHours: any = null
    if (form.specialHoursText.trim()) {
      try { specialHours = parseJsonInput(form.specialHoursText, null) } catch { return setError('Special hours must be valid JSON') }
    }
    let deliveryHours: any = null
    if (form.deliveryHoursText.trim()) {
      try { deliveryHours = parseJsonInput(form.deliveryHoursText, null) } catch { return setError('Delivery hours must be valid JSON') }
    }
    let serviceArea: any = null
    if (form.serviceAreaText.trim()) {
      try { serviceArea = parseJsonInput(form.serviceAreaText, null) } catch { return setError('Service area must be valid JSON (GeoJSON)') }
    }
    let priorityZones: any = null
    if (form.priorityZonesText.trim()) {
      try { priorityZones = parseJsonInput(form.priorityZonesText, null) } catch { return setError('Priority zones must be valid JSON') }
    }
    let restrictedAreas: any = null
    if (form.restrictedAreasText.trim()) {
      try { restrictedAreas = parseJsonInput(form.restrictedAreasText, null) } catch { return setError('Restricted areas must be valid JSON') }
    }
    let deliveryZones: any = null
    if (form.deliveryZonesText.trim()) {
      try { deliveryZones = parseJsonInput(form.deliveryZonesText, null) } catch { return setError('Delivery zones must be valid JSON') }
    }

    const operatingHours: Record<string, { open: string; close: string }[]> = {}
    for (const d of DAYS) {
      const h = form.hours[d]
      operatingHours[d.toLowerCase()] = h.closed ? [] : (h.periods || [{ open: h.open || '09:00', close: h.close || '21:00' }]).map((period, index) => index === 0 ? { open: h.open || period.open, close: h.close || period.close } : period)
    }

    setSaving(true)
    try {
      // Build full payload covering all Merchants collection fields. Matching admin BFF whitelist.
      // For edit, the BFF only patches keys present, so we include all dirty-capable fields.
      // We send all fields (dirty fields are included) to ensure complete coverage without destructive nulls for unchanged media.
      const payload: any = {
        vendor: Number(form.vendor),
        outletName: form.outletName.trim(),
        outletCode: form.outletCode.trim() || undefined,
        contactInfo: {
          phone: form.contactPhone.trim() || null,
          email: form.contactEmail.trim() || null,
          managerName: form.managerName.trim() || null,
          managerPhone: form.managerPhone.trim() || null,
        },
        isActive: form.isActive,
        isAcceptingOrders: form.isAcceptingOrders,
        is_currently_delivering: form.isCurrentlyDelivering,
        operationalStatus: form.operationalStatus,
        timezone: form.timezone,
        description: form.description.trim() || null,
        specialInstructions: form.specialInstructions.trim() || null,
        tags: form.tagsText.trim() ? form.tagsText.split(',').map((s)=> s.trim()).filter(Boolean) : [],
        merchant_categories: form.merchantCategoryIds.map(v=> Number(v)).filter(n=> !Number.isNaN(n)),
        activeAddress: form.activeAddress.trim() ? Number(form.activeAddress.trim()) : null,
        operatingHours,
        specialHours: specialHours,
        delivery_hours: deliveryHours,
        deliverySettings: {
          minimumOrderAmount: parseFloat(form.minimumOrderAmount) || 0,
          deliveryFee: parseFloat(form.deliveryFee) || 0,
          freeDeliveryThreshold: form.freeDeliveryThresholdGroup.trim() ? parseFloat(form.freeDeliveryThresholdGroup) : 0,
          estimatedDeliveryTimeMinutes: parseInt(form.estimatedDeliveryTimeMinutes, 10) || 30,
          maxDeliveryTimeMinutes: parseInt(form.maxDeliveryTimeMinutes, 10) || 60,
        },
        merchant_latitude: latNum,
        merchant_longitude: lngNum,
        location_accuracy_radius: form.locationAccuracyRadius.trim() ? Number(form.locationAccuracyRadius) : null,
        delivery_radius_meters: form.deliveryRadiusMeters.trim() ? Number(form.deliveryRadiusMeters) : null,
        max_delivery_radius_meters: form.maxDeliveryRadiusMeters.trim() ? Number(form.maxDeliveryRadiusMeters) : null,
        min_order_amount: form.minOrderAmountTop.trim() ? Number(form.minOrderAmountTop) : null,
        delivery_fee_base: form.deliveryFeeBase.trim() ? Number(form.deliveryFeeBase) : null,
        delivery_fee_per_km: form.deliveryFeePerKm.trim() ? Number(form.deliveryFeePerKm) : null,
        free_delivery_threshold: form.freeDeliveryThresholdTop.trim() ? Number(form.freeDeliveryThresholdTop) : null,
        avg_delivery_time_minutes: form.avgDeliveryTimeMinutes.trim() ? Number(form.avgDeliveryTimeMinutes) : null,
        delivery_success_rate: form.deliverySuccessRate.trim() ? Number(form.deliverySuccessRate) : null,
        peak_hours_multiplier: form.peakHoursMultiplier.trim() ? Number(form.peakHoursMultiplier) : null,
        next_available_slot: form.nextAvailableSlot ? new Date(form.nextAvailableSlot).toISOString() : null,
        service_area: serviceArea,
        priority_zones: priorityZones,
        restricted_areas: restrictedAreas,
        delivery_zones: deliveryZones,
      }
      // media handling — build group with thumbnail, storeFrontImage, interiorImages, menuImages
      const media: any = {}
      if (thumbnailId != null && String(thumbnailId).trim() !== '') media.thumbnail = Number(thumbnailId)
      else if (isEdit && thumbnailId === '' ) media.thumbnail = null
      if (storeFrontImageId != null && String(storeFrontImageId).trim() !== '') media.storeFrontImage = Number(storeFrontImageId)
      else if (isEdit && storeFrontImageId === '' ) media.storeFrontImage = null
      // interior/menu: always send as array (empty array means clear if edited)
      const interiorNums = interiorIds.filter(x=> String(x).trim()!=='').map(v=> Number(v)).filter(n=> !Number.isNaN(n))
      const menuNums = menuIds.filter(x=> String(x).trim()!=='').map(v=> Number(v)).filter(n=> !Number.isNaN(n))
      // Only include if we have values or if editing and arrays differ from initial (to avoid wiping when untouched empty?)
      // For complete coverage we always send arrays; BFF will persist them. Empty means clear.
      media.interiorImages = interiorNums
      media.menuImages = menuNums
      payload.media = media

      // Dirty optimization: if editing, strip keys where value equals initial to reduce payload and avoid unintended overwrites for optional clears
      // We keep semantics simple: only send media interior/menu if they changed or have values; but for now we send all — BFF handles partial, and sending same value is idempotent.
      // To strictly "send all dirty fields", we ensure at least dirty fields are included; sending extra unchanged fields is safe (Payload will no-op).

      const url = isEdit ? `/api/merchants/${(initial as any).id}` : '/api/merchants'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const j = await res.json().catch(()=>({}))
      if (!res.ok) throw new Error(j.error || j.details || 'Request failed')
      onSuccess()
    } catch (e:any) { setError(e.message || 'Save failed') }
    finally { setSaving(false) }
  }

  const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm'
  const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]'
  const textareaCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm font-mono'

  const MediaArraySection = ({ title, ids, setIds }: { title: string; ids: (string|number)[]; setIds: (v:(string|number)[])=> void }) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={labelCls}>{title}</span>
        <button type="button" onClick={()=> setIds([...ids, ''])} className="text-xs font-medium text-[#eba236] hover:text-[#c88a20]">+ Add image</button>
      </div>
      {ids.length===0 && <p className="text-xs text-gray-400">No images yet. Click Add image.</p>}
      {ids.map((id, idx)=> (
        <div key={idx} className="flex gap-2 items-start">
          <div className="flex-1">
            <MediaUploader value={id as any} onChange={(newId)=> {
              const copy=[...ids]; copy[idx]=newId as any; setIds(copy)
            }} accept="image/*" className="mt-1" />
          </div>
          <button type="button" onClick={()=>{
            const copy=[...ids]; copy.splice(idx,1); setIds(copy)
          }} className="mt-2 px-2 py-1 text-xs rounded border border-gray-200 dark:border-[#262626] hover:bg-gray-50 dark:hover:bg-[#262626]">Remove</button>
        </div>
      ))}
    </div>
  )

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
      <div className="p-6 space-y-7">
        {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Building className="w-4 h-4 text-[#eba236]" /> Vendor & Identity</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelCls}>Vendor *</label>
              <select value={form.vendor} onChange={e=>set('vendor', e.target.value)} className={inputCls}>
                <option value="">Select vendor</option>
                {vendors.map(v=> <option key={v.id} value={String(v.id)}>{v.businessName} (#{v.id})</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Parent business entity — required</p>
            </div>
            <div><label className={labelCls}>Outlet name *</label><input value={form.outletName} onChange={e=>set('outletName', e.target.value)} placeholder="Jollibee Manila" className={inputCls} /></div>
            <div><label className={labelCls}>Outlet code <span className="text-gray-400 font-normal">(auto if blank)</span></label><input value={form.outletCode} onChange={e=>set('outletCode', e.target.value)} placeholder="JB-MNL-001" className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Timezone *</label><select value={form.timezone} onChange={e=>set('timezone', e.target.value)} className={inputCls}>{TIMEZONES.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}</select></div>
            <div className="flex items-center gap-3 pt-6 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={e=>set('isActive', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Active</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isAcceptingOrders} onChange={e=>set('isAcceptingOrders', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Accepting orders</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isCurrentlyDelivering} onChange={e=>set('isCurrentlyDelivering', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Currently delivering</span></label>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Phone className="w-4 h-4 text-blue-600" /> Contact</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Outlet phone</label><input value={form.contactPhone} onChange={e=>set('contactPhone', e.target.value)} placeholder="+63 912 345 6789" className={inputCls} /></div>
            <div><label className={labelCls}>Outlet email</label><input value={form.contactEmail} onChange={e=>set('contactEmail', e.target.value)} placeholder="outlet@business.com" type="email" className={inputCls} /></div>
            <div><label className={labelCls}>Manager name</label><input value={form.managerName} onChange={e=>set('managerName', e.target.value)} placeholder="Juan Dela Cruz" className={inputCls} /></div>
            <div><label className={labelCls}>Manager phone</label><input value={form.managerPhone} onChange={e=>set('managerPhone', e.target.value)} placeholder="+63 912..." className={inputCls} /></div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-600" /> Operational</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Operational status</label><select value={form.operationalStatus} onChange={e=>set('operationalStatus', e.target.value)} className={inputCls}>{OPERATIONAL_OPTS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div><label className={labelCls}>Avg delivery time (minutes)</label><input type="number" min={0} value={form.avgDeliveryTimeMinutes} onChange={e=>set('avgDeliveryTimeMinutes', e.target.value)} placeholder="25" className={inputCls} /></div>
            <div><label className={labelCls}>Delivery success rate (0–1)</label><input type="number" min={0} max={1} step={0.0001} value={form.deliverySuccessRate} onChange={e=>set('deliverySuccessRate', e.target.value)} placeholder="0.98" className={inputCls} /></div>
            <div><label className={labelCls}>Peak hours multiplier (≥1)</label><input type="number" min={1} step={0.1} value={form.peakHoursMultiplier} onChange={e=>set('peakHoursMultiplier', e.target.value)} placeholder="1.5" className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Description</label><textarea value={form.description} onChange={e=>set('description', e.target.value)} rows={3} placeholder="Outlet description, features…" className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Special instructions</label><textarea value={form.specialInstructions} onChange={e=>set('specialInstructions', e.target.value)} rows={3} placeholder="Delivery / pickup instructions for riders" className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}><Tag className="w-3 h-3 inline mr-1" /> Tags (comma separated)</label><input value={form.tagsText} onChange={e=>set('tagsText', e.target.value)} placeholder="flagship, mall, 24h" className={inputCls} /></div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Next available slot</label>
              <input type="datetime-local" value={form.nextAvailableSlot} onChange={e=>set('nextAvailableSlot', e.target.value)} className={inputCls} />
              <p className="text-xs text-gray-400 mt-1">Maps to next_available_slot (ISO). Leave blank for null.</p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Tag className="w-4 h-4 text-purple-600" /> Categories & Address</h4>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Merchant categories</label>
              {categories.length===0 ? <p className="text-xs text-gray-400 mt-1">No categories found or still loading… Check /api/merchant-categories BFF.</p> : (
                <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-auto border border-gray-200 dark:border-[#262626] rounded-lg p-2 bg-gray-50 dark:bg-[#0a0a0a]">
                  {categories.map(c=> (
                    <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white dark:hover:bg-[#171717] px-1.5 py-1 rounded">
                      <input type="checkbox" checked={form.merchantCategoryIds.includes(String(c.id))} onChange={()=> toggleCategory(String(c.id))} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" />
                      <span className="text-gray-700 dark:text-white truncate">{c.name} <span className="text-xs text-gray-400">#{c.id}</span></span>
                    </label>
                  ))}
                </div>
              )}
              {form.merchantCategoryIds.length>0 && <p className="text-xs text-gray-500 mt-1">Selected: {form.merchantCategoryIds.join(', ')}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Active address ID <span className="text-gray-400 font-normal">(relationship → addresses)</span></label>
                <input type="number" value={form.activeAddress} onChange={e=>set('activeAddress', e.target.value)} placeholder="e.g. 12" className={`${inputCls} font-mono`} />
                <p className="text-xs text-gray-400 mt-1">Numeric ID of addresses collection. Admin BFF expects Number; filtered to vendor user in Payload.</p>
              </div>
              <div><label className={labelCls}>Location accuracy radius (m)</label><input type="number" min={0} value={form.locationAccuracyRadius} onChange={e=>set('locationAccuracyRadius', e.target.value)} placeholder="50" className={`${inputCls} font-mono`} /></div>
              <div><label className={labelCls}>Merchant latitude</label><input value={form.merchantLatitude} onChange={e=>set('merchantLatitude', e.target.value)} placeholder="14.5500" className={`${inputCls} font-mono`} /></div>
              <div><label className={labelCls}>Merchant longitude</label><input value={form.merchantLongitude} onChange={e=>set('merchantLongitude', e.target.value)} placeholder="121.0500" className={`${inputCls} font-mono`} /></div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Truck className="w-4 h-4 text-[#eba236]" /> Delivery settings (group) & Radii / Fees (top-level)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Group: minimumOrderAmount (₱)</label><input type="number" min={0} value={form.minimumOrderAmount} onChange={e=>set('minimumOrderAmount', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Group: deliveryFee (₱)</label><input type="number" min={0} value={form.deliveryFee} onChange={e=>set('deliveryFee', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Group: freeDeliveryThreshold (₱)</label><input type="number" min={0} value={form.freeDeliveryThresholdGroup} onChange={e=>set('freeDeliveryThresholdGroup', e.target.value)} placeholder="0 = none" className={inputCls} /></div>
            <div><label className={labelCls}>Group: estimatedDeliveryTimeMinutes</label><input type="number" min={5} max={120} value={form.estimatedDeliveryTimeMinutes} onChange={e=>set('estimatedDeliveryTimeMinutes', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Group: maxDeliveryTimeMinutes</label><input type="number" min={10} max={180} value={form.maxDeliveryTimeMinutes} onChange={e=>set('maxDeliveryTimeMinutes', e.target.value)} className={inputCls} /></div>
            <div className="sm:col-span-2 border-t border-gray-100 dark:border-[#262626] pt-3 mt-1">
              <p className="text-xs font-semibold text-gray-600 dark:text-[#a1a1aa] mb-2 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Top-level fees & radii</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className={labelCls}>delivery_radius_meters</label><input type="number" min={0} value={form.deliveryRadiusMeters} onChange={e=>set('deliveryRadiusMeters', e.target.value)} className={`${inputCls} font-mono`} /></div>
                <div><label className={labelCls}>max_delivery_radius_meters</label><input type="number" min={0} value={form.maxDeliveryRadiusMeters} onChange={e=>set('maxDeliveryRadiusMeters', e.target.value)} className={`${inputCls} font-mono`} /></div>
                <div><label className={labelCls}>min_order_amount (₱)</label><input type="number" min={0} value={form.minOrderAmountTop} onChange={e=>set('minOrderAmountTop', e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>delivery_fee_base (₱)</label><input type="number" min={0} value={form.deliveryFeeBase} onChange={e=>set('deliveryFeeBase', e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>delivery_fee_per_km (₱)</label><input type="number" min={0} step={0.01} value={form.deliveryFeePerKm} onChange={e=>set('deliveryFeePerKm', e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>free_delivery_threshold (₱)</label><input type="number" min={0} value={form.freeDeliveryThresholdTop} onChange={e=>set('freeDeliveryThresholdTop', e.target.value)} className={inputCls} /></div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-[#eba236]" /> Media</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Thumbnail</label>
              <MediaUploader value={thumbnailId} onChange={id=>setThumbnailId(id)} accept="image/*" className="mt-1" />
            </div>
            <div>
              <label className={labelCls}>Store front image</label>
              <MediaUploader value={storeFrontImageId} onChange={id=>setStoreFrontImageId(id)} accept="image/*" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <MediaArraySection title="Interior images (media.interiorImages → json array)" ids={interiorIds} setIds={setInteriorIds} />
            <MediaArraySection title="Menu images (media.menuImages → json array)" ids={menuIds} setIds={setMenuIds} />
          </div>
          <p className="text-xs text-gray-400 mt-2">Interior/menu stored as json arrays of media IDs via media group. Use Add image to upload.</p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-[#eba236]" /> Weekly operating hours</h4>
          <div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden">
            {DAYS.map((day) => {
              const h = form.hours[day] || { open: '09:00', close: '21:00', closed: false }
              return (
                <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-2.5">
                  <span className="text-sm font-medium text-gray-900 dark:text-white w-24 shrink-0">{day}</span>
                  <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-[#a1a1aa] cursor-pointer shrink-0">
                    <input type="checkbox" checked={!!h.closed} onChange={(e) => setDay(day, 'closed', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> Closed
                  </label>
                  <div className={`flex flex-col gap-2 ${h.closed ? 'opacity-40 pointer-events-none' : ''}`}>
                    {(h.periods || [{ open: h.open || '09:00', close: h.close || '21:00' }]).map((period, periodIndex) => (
                      <div key={`${day}-${periodIndex}`} className="flex items-center gap-2">
                        <input type="time" value={periodIndex === 0 ? h.open : period.open} onChange={(e) => periodIndex === 0 ? setDay(day, 'open', e.target.value) : setForm(prev => ({ ...prev, hours: { ...prev.hours, [day]: { ...h, periods: (h.periods || [period]).map((p, i) => i === periodIndex ? { ...p, open: e.target.value } : p) } } }))} disabled={h.closed} className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm" />
                        <span className="text-gray-400">to</span>
                        <input type="time" value={periodIndex === 0 ? h.close : period.close} onChange={(e) => periodIndex === 0 ? setDay(day, 'close', e.target.value) : setForm(prev => ({ ...prev, hours: { ...prev.hours, [day]: { ...h, periods: (h.periods || [period]).map((p, i) => i === periodIndex ? { ...p, close: e.target.value } : p) } } }))} disabled={h.closed} className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm" />
                        {periodIndex > 0 && <button type="button" onClick={() => removePeriod(day, periodIndex)} disabled={h.closed} className="text-xs text-red-600 hover:underline">Remove</button>}
                      </div>
                    ))}
                    <button type="button" onClick={() => addPeriod(day)} disabled={h.closed} className="self-start text-xs font-medium text-[#b97810] hover:underline">Add period</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-600" /> Special hours & Delivery hours (JSON)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>specialHours (JSON array: date, openTime, closeTime, isClosed, reason)</label>
              <textarea value={form.specialHoursText} onChange={e=>set('specialHoursText', e.target.value)} rows={5} placeholder='[ { "date": "2026-12-25", "isClosed": true, "reason": "Christmas" } ]' className={textareaCls} />
            </div>
            <div>
              <label className={labelCls}>delivery_hours (JSON)</label>
              <textarea value={form.deliveryHoursText} onChange={e=>set('deliveryHoursText', e.target.value)} rows={5} placeholder='{"monday": {"open":"09:00","close":"21:00"}} or null' className={textareaCls} />
              <p className="text-xs text-gray-400 mt-1">Aliases: delivery_hours / deliveryHours → BFF maps to delivery_hours</p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><MapPin className="w-4 h-4 text-emerald-600" /> Service & Delivery Zones (GeoJSON)</h4>
          <p className="text-xs text-gray-500 mb-3">Editable GeoJSON; read-only *_geometry fields are auto-derived in CMS. Use valid GeoJSON (Polygon/MultiPolygon). Leave blank for null.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>service_area (GeoJSON Polygon)</label><textarea value={form.serviceAreaText} onChange={e=>set('serviceAreaText', e.target.value)} rows={4} placeholder='{"type":"Polygon","coordinates":[[[121,14],[121.1,14],[121.1,14.1],[121,14.1],[121,14]]]}' className={textareaCls} /></div>
            <div><label className={labelCls}>priority_zones (MultiPolygon)</label><textarea value={form.priorityZonesText} onChange={e=>set('priorityZonesText', e.target.value)} rows={4} placeholder='{"type":"MultiPolygon","coordinates":[...]}' className={textareaCls} /></div>
            <div><label className={labelCls}>restricted_areas (MultiPolygon)</label><textarea value={form.restrictedAreasText} onChange={e=>set('restrictedAreasText', e.target.value)} rows={4} placeholder='{"type":"MultiPolygon","coordinates":[...]}' className={textareaCls} /></div>
            <div><label className={labelCls}>delivery_zones (zone pricing JSONB)</label><textarea value={form.deliveryZonesText} onChange={e=>set('deliveryZonesText', e.target.value)} rows={4} placeholder='[{"zone":"A","fee":50,"polygon":{...}}]' className={textareaCls} /></div>
          </div>
        </div>

      </div>
      <div className="flex items-center justify-end gap-2 border-t border-gray-200 dark:border-[#262626] bg-gray-50 dark:bg-[#0a0a0a] px-6 py-4 rounded-b-xl">
        <button type="button" onClick={onCancel} disabled={saving} className="rounded-lg border border-gray-300 dark:border-[#262626] bg-white dark:bg-[#171717] px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#a1a1aa] hover:bg-gray-50 dark:hover:bg-[#262626] disabled:opacity-50">Cancel</button>
        <button type="button" onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#eba236] hover:bg-[#c88a20] px-6 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} {isEdit ? 'Save changes' : 'Create outlet'}
        </button>
      </div>
    </div>
  )
}
