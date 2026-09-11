'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Building2, Mail, Store, MapPin, Clock, Truck, AlertCircle, RefreshCw, Phone, DollarSign, Tag, Image as ImageIcon, Globe, Layers, Timer, Zap, ChevronDown } from '@/components/ui/IconWrapper';
import { MediaUploader } from '@/components/cms/MediaUploader';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const TIMEZONES = ['Asia/Manila', 'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'UTC'];

type OutletDoc = {
  id: string;
  outletName: string;
  outletCode: string;
  description: string;
  specialInstructions: string;
  tags: string[];
  isActive: boolean;
  isAcceptingOrders: boolean;
  is_currently_delivering?: boolean | null;
  isCurrentlyDelivering?: boolean | null;
  operationalStatus: string;
  timezone?: string | null;
  next_available_slot?: string | null;
  nextAvailableSlot?: string | null;
  operatingHours: Record<string, { open: string; close: string; closed: boolean }> | null;
  specialHours?: unknown | null;
  delivery_hours?: unknown | null;
  deliveryHours?: unknown | null;
  service_area?: unknown | null;
  serviceArea?: unknown | null;
  priority_zones?: unknown | null;
  restricted_areas?: unknown | null;
  delivery_zones?: unknown | null;
  location_accuracy_radius?: number | null;
  locationAccuracyRadius?: number | null;
  peak_hours_multiplier?: number | null;
  avg_delivery_time_minutes?: number | null;
  merchant_categories?: Array<{ id: number; name: string } | number> | null;
  // CMS `merchants.activeAddress` relationship (same as /admin/collections/merchants/:id).
  // BFF returns both `address` (sanitized) and `activeAddress`/`activeAddressId`.
  activeAddress?: { id?: string | number; formattedAddress?: string; formatted_address?: string } | string | number | null;
  activeAddressId?: string | number | null;
  contactInfo: { phone: string; email: string; managerName: string; managerPhone: string };
  deliverySettings: {
    minimumOrderAmount: number;
    deliveryFee: number;
    freeDeliveryThreshold: number;
    estimatedDeliveryTimeMinutes: number;
    maxDeliveryTimeMinutes: number;
    deliveryRadiusMeters: number;
    maxDeliveryRadiusMeters: number;
    deliveryFeePerKm: number;
  };
  address: {
    id?: string | number | null;
    street: string;
    locality: string;
    province: string;
    postalCode: string;
    country: string;
    latitude: number;
    longitude: number;
    barangay?: string | null;
    floor_unit_room?: string | null;
    delivery_instructions?: string | null;
    landmark_description?: string | null;
    floorUnitRoom?: string | null;
    deliveryInstructions?: string | null;
    landmarkDescription?: string | null;
    formattedAddress?: string | null;
    formatted_address?: string | null;
  } | null;
  media?: {
    thumbnail?: { id?: string | number; url?: string } | null;
    storeFrontImage?: { id?: string | number; url?: string } | null;
    interiorImages?: unknown | null;
    menuImages?: unknown | null;
  } | null;
};

type VendorAddressOption = {
  id: number;
  formatted_address: string;
  formattedAddress: string;
  street: string;
  locality: string;
  province: string;
  postal_code: string;
};

function getInitialActiveAddressId(doc: OutletDoc | null | undefined): string {
  if (!doc) return '';
  const raw = (doc as Record<string, unknown>).activeAddressId ?? (doc as Record<string, unknown>).activeAddress ?? (doc.address as Record<string, unknown> | null)?.id;
  if (raw == null || raw === '') return '';
  if (typeof raw === 'object' && raw !== null && 'id' in (raw as Record<string, unknown>)) {
    const id = (raw as Record<string, unknown>).id;
    return id != null ? String(id) : '';
  }
  return String(raw);
}

const inputCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236]';
const labelCls = 'text-xs font-medium text-gray-700 dark:text-[#a1a1aa]';
const textareaCls = 'mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-gray-900 dark:text-white font-mono placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236]';

// Facebook-style dropdown: the field itself is always visible; skeleton rows render
// INSIDE the opened options panel while vendor-owned addresses load — never in place of the field.
function ActiveAddressDropdown({
  value,
  options,
  loading,
  error,
  onChange,
}: {
  value: string;
  options: VendorAddressOption[];
  loading: boolean;
  error: string | null;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const trimmed = value.trim();
  const selected = options.find((a) => String(a.id) === trimmed);
  const buttonLabel = !trimmed
    ? '— Select —'
    : selected
      ? `#${selected.id} — ${(selected.formatted_address || `${selected.street}, ${selected.locality}`).slice(0, 80)}`
      : `#${trimmed}`;

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm text-left text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#eba236]/20 focus:border-[#eba236] flex items-center justify-between gap-2"
      >
        <span className={`truncate font-mono ${!trimmed ? 'text-gray-400' : ''}`}>{buttonLabel}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="listbox" className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#171717] shadow-lg overflow-hidden">
          {loading ? (
            <div className="p-2 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-10 rounded-md bg-gray-100 dark:bg-[#262626] animate-pulse" />
              ))}
            </div>
          ) : error && options.length === 0 ? (
            <p className="px-3 py-3 text-xs text-red-600">{error}</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-500">No addresses found</p>
          ) : (
            <ul className="max-h-60 overflow-auto py-1">
              <li>
                <button type="button" onClick={() => pick('')} className="w-full text-left px-3 py-2.5 text-sm text-gray-400 hover:bg-gray-50 dark:hover:bg-[#262626]">
                  — Select —
                </button>
              </li>
              {options.map((a) => {
                const active = String(a.id) === trimmed;
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => pick(String(a.id))}
                      className={`w-full text-left px-3 py-2.5 text-sm font-mono hover:bg-gray-50 dark:hover:bg-[#262626] ${active ? 'text-gray-900 dark:text-white font-semibold bg-[#eba236]/10' : 'text-gray-700 dark:text-[#a1a1aa]'}`}
                    >
                      #{a.id} — {(a.formatted_address || `${a.street}, ${a.locality}`).slice(0, 80)}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function buildHours(src: unknown): Record<string, { open: string; close: string; closed: boolean; periods?: { open: string; close: string }[] }> {
  const out: Record<string, { open: string; close: string; closed: boolean; periods?: { open: string; close: string }[] }> = {};
  const s = src && typeof src === 'object' && !Array.isArray(src) ? (src as Record<string, unknown>) : {};
  for (const day of DAYS) {
    const key = day.toLowerCase();
    const v = s[key] as { open?: string; close?: string; closed?: boolean } | undefined;
    const v2 = s[day] as { open?: string; close?: string; closed?: boolean } | undefined;
    const cur = v ?? v2;
    const period = Array.isArray(cur) ? cur[0] : cur;
    out[day] = period && typeof period === 'object' ? { open: (period as any).open || '09:00', close: (period as any).close || '21:00', closed: !!(period as any).closed, ...(Array.isArray(cur) ? { periods: cur } : {}) } : { open: '09:00', close: '21:00', closed: false };
  }
  return out;
}

function toJsonText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return '';
    try { const p = JSON.parse(t); return JSON.stringify(p, null, 2); } catch { return v; }
  }
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}
function parseJsonInput(text: string, fallback: any = null): any {
  const t = text.trim();
  if (!t) return fallback;
  return JSON.parse(t);
}
function extractMediaIds(raw: unknown): (string | number)[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((x: any) => {
      if (x == null) return null;
      if (typeof x === 'object' && 'id' in x) return (x as any).id;
      return x;
    }).filter((x: any) => x !== null && x !== '' ).map((x:any)=> x);
  }
  if (typeof raw === 'object' && raw !== null && 'id' in (raw as any)) return [(raw as any).id];
  return [raw as any];
}
function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2,'0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}
function jsonEqualText(a: string, b: string): boolean {
  const at = a.trim(); const bt = b.trim();
  if (at === bt) return true;
  if (!at && !bt) return true;
  if (!at || !bt) return false;
  try { return JSON.stringify(JSON.parse(at)) === JSON.stringify(JSON.parse(bt)); } catch { return at === bt; }
}

export type DebugLogInfo = {
  endpoint: string;
  method: string;
  payloadSent: Record<string, unknown>;
  responseStatus: number;
  responseBody: Record<string, unknown>;
  timestamp: string;
};

export function OutletForm({ initial, onSuccess, onCancel }: { initial?: OutletDoc | null; onSuccess: (updated?: any, debug?: DebugLogInfo) => void; onCancel: () => void }) {
  const isEdit = !!initial;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbnailId, setThumbnailId] = useState<string | number | undefined>(initial?.media?.thumbnail?.id);
  const [storeFrontImageId, setStoreFrontImageId] = useState<string | number | undefined>(initial?.media?.storeFrontImage?.id);
  const [interiorIds, setInteriorIds] = useState<(string | number)[]>(() => extractMediaIds((initial?.media as any)?.interiorImages ?? (initial as any)?.interiorImages));
  const [menuIds, setMenuIds] = useState<(string | number)[]>(() => extractMediaIds((initial?.media as any)?.menuImages ?? (initial as any)?.menuImages));
  // Active Address picker — strict parity with CMS /admin/collections/merchants/:id.
  // Rule (Merchants.activeAddress.filterOptions): merchant.vendor -> vendors.user
  // -> only addresses where { user equals vendorUserId }.
  const [vendorAddresses, setVendorAddresses] = useState<VendorAddressOption[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressesError, setAddressesError] = useState<string | null>(null);

  const loadVendorAddresses = async (outletId?: string | number) => {
    setAddressesLoading(true);
    setAddressesError(null);
    try {
      // Edit: pass outlet context so the BFF resolves via THAT outlet's vendor
      // (mirrors filterOptions `data.vendor`). Create: no outlet yet, BFF resolves
      // via the logged-in vendor (vendors where user == authUser.id).
      // Source is ONLY collection 'addresses' (see CMS vendor/addresses route).
      const qs = outletId != null && String(outletId).trim() !== '' ? `?outletId=${encodeURIComponent(String(outletId))}` : '';
      const res = await fetch(`/api/addresses${qs}`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || 'Failed to load addresses');
      const arr = Array.isArray(j.addresses) ? j.addresses : [];
      setVendorAddresses(arr.map((a: Record<string, unknown>) => ({
        id: Number(a.id),
        formatted_address: String((a.formatted_address ?? a.formattedAddress ?? '') as string),
        formattedAddress: String((a.formattedAddress ?? a.formatted_address ?? '') as string),
        street: String((a.street ?? '') as string),
        locality: String((a.locality ?? '') as string),
        province: String((a.province ?? '') as string),
        postal_code: String(((a.postal_code ?? a.postalCode) ?? '') as string),
      })).filter((a: VendorAddressOption) => Number.isFinite(a.id)));
    } catch (e: unknown) {
      setAddressesError(e instanceof Error ? e.message : 'Failed to load addresses');
    } finally {
      setAddressesLoading(false);
    }
  };

  useEffect(() => {
    void loadVendorAddresses((initial as OutletDoc | null | undefined)?.id);
  }, [(initial as OutletDoc | null | undefined)?.id]);

  const [form, setForm] = useState({
    outletName: initial?.outletName || '',
    outletCode: initial?.outletCode || '',
    description: initial?.description || '',
    specialInstructions: initial?.specialInstructions || '',
    tagsText: Array.isArray(initial?.tags) ? initial.tags.join(', ') : '',
    isActive: initial?.isActive ?? true,
    isAcceptingOrders: initial?.isAcceptingOrders ?? true,
    isCurrentlyDelivering: (initial as any)?.is_currently_delivering ?? (initial as any)?.isCurrentlyDelivering ?? true,
    operationalStatus: initial?.operationalStatus || 'open',
    timezone: (initial as any)?.timezone || 'Asia/Manila',
    activeAddressId: getInitialActiveAddressId(initial as OutletDoc | null | undefined),
    locationAccuracyRadius: (initial as any)?.location_accuracy_radius != null ? String((initial as any).location_accuracy_radius) : (initial as any)?.locationAccuracyRadius != null ? String((initial as any).locationAccuracyRadius) : '',
    peakHoursMultiplier: (initial as any)?.peak_hours_multiplier != null ? String((initial as any).peak_hours_multiplier) : '',
    avgDeliveryTimeMinutes: (initial as any)?.avg_delivery_time_minutes != null ? String((initial as any).avg_delivery_time_minutes) : '',
    phone: initial?.contactInfo?.phone || '',
    email: initial?.contactInfo?.email || '',
    managerName: initial?.contactInfo?.managerName || '',
    managerPhone: initial?.contactInfo?.managerPhone || '',
    hours: buildHours(initial?.operatingHours),
    specialHoursText: toJsonText((initial as any)?.specialHours),
    deliveryHoursText: toJsonText((initial as any)?.delivery_hours ?? (initial as any)?.deliveryHours),
    nextAvailableSlot: isoToLocal((initial as any)?.next_available_slot ?? (initial as any)?.nextAvailableSlot),
    serviceAreaText: toJsonText((initial as any)?.service_area ?? (initial as any)?.serviceArea),
    priorityZonesText: toJsonText((initial as any)?.priority_zones),
    restrictedAreasText: toJsonText((initial as any)?.restricted_areas),
    deliveryZonesText: toJsonText((initial as any)?.delivery_zones),
    minimumOrderAmount: String(initial?.deliverySettings?.minimumOrderAmount ?? 0),
    deliveryFee: String(initial?.deliverySettings?.deliveryFee ?? 0),
    freeDeliveryThreshold: initial?.deliverySettings?.freeDeliveryThreshold ? String(initial.deliverySettings.freeDeliveryThreshold) : '',
    estimatedDeliveryTimeMinutes: String(initial?.deliverySettings?.estimatedDeliveryTimeMinutes ?? 30),
    maxDeliveryTimeMinutes: String(initial?.deliverySettings?.maxDeliveryTimeMinutes ?? 60),
    deliveryRadiusMeters: String(initial?.deliverySettings?.deliveryRadiusMeters ?? 5000),
    maxDeliveryRadiusMeters: String(initial?.deliverySettings?.maxDeliveryRadiusMeters ?? 10000),
    deliveryFeePerKm: String(initial?.deliverySettings?.deliveryFeePerKm ?? 0),
  });

  const set = (k: string, v: string | boolean | Record<string, { open: string; close: string; closed: boolean }>) =>
    setForm((prev) => ({ ...prev, [k]: v }) as typeof form);
  const setDay = (day: string, key: string, v: string | boolean) =>
    setForm((prev) => {
      const current = prev.hours[day] || { open: '09:00', close: '21:00', closed: false };
      const periods = current.periods || [{ open: current.open, close: current.close }];
      return { ...prev, hours: { ...prev.hours, [day]: { ...current, [key]: v, periods: key === 'closed' ? periods : periods.map((period, index) => index === 0 ? { ...period, [key]: v } : period) } } };
    });
  const addPeriod = (day: string) => setForm((prev) => {
    const current = prev.hours[day] || { open: '09:00', close: '21:00', closed: false };
    return { ...prev, hours: { ...prev.hours, [day]: { ...current, closed: false, periods: [...(current.periods || [{ open: current.open, close: current.close }]), { open: '17:00', close: '21:00' }] } } };
  });
  const removePeriod = (day: string, index: number) => setForm((prev) => {
    const current = prev.hours[day];
    if (!current?.periods || current.periods.length <= 1) return prev;
    const periods = current.periods.filter((_, periodIndex) => periodIndex !== index);
    return { ...prev, hours: { ...prev.hours, [day]: { ...current, open: periods[0].open, close: periods[0].close, periods } } };
  });

  useEffect(() => {
    if (!initial) return;
    setForm({
      outletName: initial.outletName || '',
      outletCode: initial.outletCode || '',
      description: initial.description || '',
      specialInstructions: initial.specialInstructions || '',
      tagsText: Array.isArray(initial.tags) ? initial.tags.join(', ') : '',
      isActive: initial.isActive ?? true,
      isAcceptingOrders: initial.isAcceptingOrders ?? true,
      isCurrentlyDelivering: (initial as any)?.is_currently_delivering ?? (initial as any)?.isCurrentlyDelivering ?? true,
      operationalStatus: initial.operationalStatus || 'open',
      timezone: (initial as any)?.timezone || 'Asia/Manila',
      activeAddressId: getInitialActiveAddressId(initial as OutletDoc | null | undefined),
      locationAccuracyRadius: (initial as any)?.location_accuracy_radius != null ? String((initial as any).location_accuracy_radius) : (initial as any)?.locationAccuracyRadius != null ? String((initial as any).locationAccuracyRadius) : '',
      peakHoursMultiplier: (initial as any)?.peak_hours_multiplier != null ? String((initial as any).peak_hours_multiplier) : '',
      avgDeliveryTimeMinutes: (initial as any)?.avg_delivery_time_minutes != null ? String((initial as any).avg_delivery_time_minutes) : '',
      phone: initial.contactInfo?.phone || '',
      email: initial.contactInfo?.email || '',
      managerName: initial.contactInfo?.managerName || '',
      managerPhone: initial.contactInfo?.managerPhone || '',
      hours: buildHours(initial.operatingHours),
      specialHoursText: toJsonText((initial as any)?.specialHours),
      deliveryHoursText: toJsonText((initial as any)?.delivery_hours ?? (initial as any)?.deliveryHours),
      nextAvailableSlot: isoToLocal((initial as any)?.next_available_slot ?? (initial as any)?.nextAvailableSlot),
      serviceAreaText: toJsonText((initial as any)?.service_area ?? (initial as any)?.serviceArea),
      priorityZonesText: toJsonText((initial as any)?.priority_zones),
      restrictedAreasText: toJsonText((initial as any)?.restricted_areas),
      deliveryZonesText: toJsonText((initial as any)?.delivery_zones),
      minimumOrderAmount: String(initial.deliverySettings?.minimumOrderAmount ?? 0),
      deliveryFee: String(initial.deliverySettings?.deliveryFee ?? 0),
      freeDeliveryThreshold: initial.deliverySettings?.freeDeliveryThreshold ? String(initial.deliverySettings.freeDeliveryThreshold) : '',
      estimatedDeliveryTimeMinutes: String(initial.deliverySettings?.estimatedDeliveryTimeMinutes ?? 30),
      maxDeliveryTimeMinutes: String(initial.deliverySettings?.maxDeliveryTimeMinutes ?? 60),
      deliveryRadiusMeters: String(initial.deliverySettings?.deliveryRadiusMeters ?? 5000),
      maxDeliveryRadiusMeters: String(initial.deliverySettings?.maxDeliveryRadiusMeters ?? 10000),
      deliveryFeePerKm: String(initial.deliverySettings?.deliveryFeePerKm ?? 0),
    });
    setThumbnailId(initial.media?.thumbnail?.id);
    setStoreFrontImageId(initial.media?.storeFrontImage?.id);
    setInteriorIds(extractMediaIds((initial?.media as any)?.interiorImages ?? (initial as any)?.interiorImages));
    setMenuIds(extractMediaIds((initial?.media as any)?.menuImages ?? (initial as any)?.menuImages));
    setError(null);
  }, [initial]);

  const submit = async () => {
    setError(null);
    if (!form.outletName.trim() || form.outletName.trim().length < 2) return setError('Outlet name is required (min 2 chars)');
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError('Contact email is invalid');
    // Active Address is the ONLY address source (same relationship as CMS merchants.activeAddress → addresses).
    // It must be an address owned by the vendor user owner of this merchant — never manual street/city/province inputs.
    if (!form.activeAddressId.trim()) return setError('Active Address is required — select an address owned by the vendor user');
    {
      const n = Number(form.activeAddressId.trim());
      if (!Number.isFinite(n) || n <= 0) return setError('Active Address must be a valid address from the dropdown');
    }
    // IANA timezone validation
    try { Intl.DateTimeFormat(undefined, { timeZone: form.timezone.trim() }); } catch { return setError('Timezone must be a valid IANA identifier (e.g. Asia/Manila)'); }
    if (form.locationAccuracyRadius.trim()) {
      const n = Number(form.locationAccuracyRadius);
      if (Number.isNaN(n) || n < 0) return setError('Location accuracy radius must be >= 0');
    }
    if (form.peakHoursMultiplier.trim()) {
      const n = Number(form.peakHoursMultiplier);
      if (Number.isNaN(n) || n < 1) return setError('Peak hours multiplier must be >= 1');
    }
    if (form.avgDeliveryTimeMinutes.trim()) {
      const n = Number(form.avgDeliveryTimeMinutes);
      if (Number.isNaN(n) || n < 0) return setError('Avg delivery time must be >= 0');
    }
    let specialHoursParsed: any = null;
    let specialHoursDirty = false;
    const initialSpecialText = toJsonText((initial as any)?.specialHours);
    if (!jsonEqualText(form.specialHoursText, initialSpecialText) || !isEdit) {
      if (form.specialHoursText.trim()) {
        try { specialHoursParsed = parseJsonInput(form.specialHoursText, null); } catch { return setError('Special hours must be valid JSON'); }
        specialHoursDirty = true;
      } else if (isEdit && initialSpecialText.trim()) {
        // cleared
        specialHoursParsed = null;
        specialHoursDirty = true;
      }
    }
    let deliveryHoursParsed: any = null;
    let deliveryHoursDirty = false;
    const initialDeliveryText = toJsonText((initial as any)?.delivery_hours ?? (initial as any)?.deliveryHours);
    if (!jsonEqualText(form.deliveryHoursText, initialDeliveryText) || (!isEdit && form.deliveryHoursText.trim())) {
      if (form.deliveryHoursText.trim()) {
        try { deliveryHoursParsed = parseJsonInput(form.deliveryHoursText, null); } catch { return setError('Delivery hours must be valid JSON'); }
        deliveryHoursDirty = true;
      } else if (isEdit && initialDeliveryText.trim()) {
        deliveryHoursParsed = null;
        deliveryHoursDirty = true;
      }
    }
    let serviceAreaParsed: any = null;
    let serviceAreaDirty = false;
    const initialServiceText = toJsonText((initial as any)?.service_area ?? (initial as any)?.serviceArea);
    if (!jsonEqualText(form.serviceAreaText, initialServiceText) || (!isEdit && form.serviceAreaText.trim())) {
      if (form.serviceAreaText.trim()) {
        try { serviceAreaParsed = parseJsonInput(form.serviceAreaText, null); } catch { return setError('Service area must be valid GeoJSON'); }
        serviceAreaDirty = true;
      } else if (isEdit && initialServiceText.trim()) {
        serviceAreaParsed = null;
        serviceAreaDirty = true;
      }
    }
    // optional zone json dirty tracking
    let priorityZonesParsed: any = null;
    let priorityZonesDirty = false;
    const initPriorityText = toJsonText((initial as any)?.priority_zones);
    if (!jsonEqualText(form.priorityZonesText, initPriorityText)) {
      if (form.priorityZonesText.trim()) { try { priorityZonesParsed = parseJsonInput(form.priorityZonesText, null); } catch { return setError('Priority zones must be valid JSON'); } priorityZonesDirty = true; }
      else if (isEdit && initPriorityText.trim()) { priorityZonesParsed = null; priorityZonesDirty = true; }
    }
    let restrictedAreasParsed: any = null;
    let restrictedAreasDirty = false;
    const initRestrictedText = toJsonText((initial as any)?.restricted_areas);
    if (!jsonEqualText(form.restrictedAreasText, initRestrictedText)) {
      if (form.restrictedAreasText.trim()) { try { restrictedAreasParsed = parseJsonInput(form.restrictedAreasText, null); } catch { return setError('Restricted areas must be valid JSON'); } restrictedAreasDirty = true; }
      else if (isEdit && initRestrictedText.trim()) { restrictedAreasParsed = null; restrictedAreasDirty = true; }
    }
    let deliveryZonesParsed: any = null;
    let deliveryZonesDirty = false;
    const initDeliveryZonesText = toJsonText((initial as any)?.delivery_zones);
    if (!jsonEqualText(form.deliveryZonesText, initDeliveryZonesText)) {
      if (form.deliveryZonesText.trim()) { try { deliveryZonesParsed = parseJsonInput(form.deliveryZonesText, null); } catch { return setError('Delivery zones must be valid JSON'); } deliveryZonesDirty = true; }
      else if (isEdit && initDeliveryZonesText.trim()) { deliveryZonesParsed = null; deliveryZonesDirty = true; }
    }

    if (form.nextAvailableSlot.trim()) {
      const d = new Date(form.nextAvailableSlot);
      if (Number.isNaN(d.getTime())) return setError('Next available slot must be a valid date/time');
    }

    const operatingHours: Record<string, { open: string; close: string }[]> = {};
    for (const d of DAYS) {
      const h = form.hours[d];
      operatingHours[d.toLowerCase()] = h.closed ? [] : (h.periods || [{ open: h.open || '09:00', close: h.close || '21:00' }]).map((period, index) => index === 0 ? { open: h.open || period.open, close: h.close || period.close } : period);
    }

    setSaving(true);
    try {
      // Address source of truth is ONLY merchants.activeAddress (relationship → addresses).
      // Never send manual address object — the dropdown of vendor-owned addresses is the single source.
      const initialMedia: any = (initial as any)?.media;
      // Media: only send when id actually changed (like web-admin VendorForm does with `if (logoId)` )
      const initialThumb = initialMedia?.thumbnail?.id != null ? String(initialMedia.thumbnail.id) : ''
      const initialStore = initialMedia?.storeFrontImage?.id != null ? String(initialMedia.storeFrontImage.id) : ''
      const curThumb = thumbnailId != null && thumbnailId !== '' ? String(thumbnailId) : ''
      const curStore = storeFrontImageId != null && storeFrontImageId !== '' ? String(storeFrontImageId) : ''
      const mediaDirty = !isEdit || curThumb !== initialThumb || curStore !== initialStore
      const interiorInitial = extractMediaIds((initialMedia as any)?.interiorImages ?? (initial as any)?.interiorImages).map(String).sort().join(',')
      const menuInitial = extractMediaIds((initialMedia as any)?.menuImages ?? (initial as any)?.menuImages).map(String).sort().join(',')
      const interiorCur = interiorIds.filter(x=> String(x).trim()!=='').map(String).sort().join(',')
      const menuCur = menuIds.filter(x=> String(x).trim()!=='').map(String).sort().join(',')
      const interiorDirty = !isEdit ? interiorCur !== '' : interiorCur !== interiorInitial
      const menuDirty = !isEdit ? menuCur !== '' : menuCur !== menuInitial
      const anyMediaDirty = mediaDirty || interiorDirty || menuDirty
      const mediaPayload: Record<string, unknown> | undefined = !anyMediaDirty
        ? undefined
        : {
            ...(curThumb !== initialThumb ? { thumbnail: curThumb ? Number(curThumb) : null } : {}),
            ...(curStore !== initialStore ? { storeFrontImage: curStore ? Number(curStore) : null } : {}),
            ...(interiorDirty ? { interiorImages: interiorIds.filter(x=> String(x).trim()!=='').map(v=> Number(v)).filter(n=> !Number.isNaN(n)) } : {}),
            ...(menuDirty ? { menuImages: menuIds.filter(x=> String(x).trim()!=='').map(v=> Number(v)).filter(n=> !Number.isNaN(n)) } : {}),
          }
      // If both media ids unchanged, omit media entirely; if one changed, only include that key.
      // Ensure we don't send empty `media: {}`.
      // Dirty checks for new top-level fields
      const initialTimezone = (initial as any)?.timezone || 'Asia/Manila';
      const timezoneDirty = !isEdit ? form.timezone.trim() !== 'Asia/Manila' : form.timezone.trim() !== initialTimezone;
      const initialActiveAddressId = getInitialActiveAddressId(initial as OutletDoc | null | undefined);
      const activeAddressDirty = form.activeAddressId.trim() !== initialActiveAddressId;
      const initialDelivering = (initial as any)?.is_currently_delivering ?? (initial as any)?.isCurrentlyDelivering ?? true;
      const deliveringDirty = !isEdit ? form.isCurrentlyDelivering !== true : form.isCurrentlyDelivering !== initialDelivering;
      const initialSlot = isoToLocal((initial as any)?.next_available_slot ?? (initial as any)?.nextAvailableSlot);
      const slotDirty = form.nextAvailableSlot !== initialSlot;
      const initialLar = (initial as any)?.location_accuracy_radius != null ? String((initial as any).location_accuracy_radius) : (initial as any)?.locationAccuracyRadius != null ? String((initial as any).locationAccuracyRadius) : '';
      const larDirty = form.locationAccuracyRadius.trim() !== initialLar;
      const initialPeak = (initial as any)?.peak_hours_multiplier != null ? String((initial as any).peak_hours_multiplier) : '';
      const peakDirty = form.peakHoursMultiplier.trim() !== initialPeak;
      const initialAvg = (initial as any)?.avg_delivery_time_minutes != null ? String((initial as any).avg_delivery_time_minutes) : '';
      const avgDirty = form.avgDeliveryTimeMinutes.trim() !== initialAvg;

      const payload: Record<string, unknown> = {
        outletName: form.outletName.trim(),
        outletCode: form.outletCode.trim() || undefined,
        description: form.description.trim() || null,
        specialInstructions: form.specialInstructions.trim() || null,
        tags: form.tagsText.trim() ? form.tagsText.split(',').map((s) => s.trim()).filter(Boolean) : [],
        isActive: form.isActive,
        isAcceptingOrders: form.isAcceptingOrders,
        operationalStatus: form.operationalStatus,
        contactInfo: {
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          managerName: form.managerName.trim() || null,
          managerPhone: form.managerPhone.trim() || null,
        },
        deliverySettings: {
          minimumOrderAmount: parseFloat(form.minimumOrderAmount) || 0,
          deliveryFee: parseFloat(form.deliveryFee) || 0,
          freeDeliveryThreshold: form.freeDeliveryThreshold.trim() ? parseFloat(form.freeDeliveryThreshold) : 0,
          estimatedDeliveryTimeMinutes: parseInt(form.estimatedDeliveryTimeMinutes, 10) || 30,
          maxDeliveryTimeMinutes: parseInt(form.maxDeliveryTimeMinutes, 10) || 60,
          deliveryRadiusMeters: parseInt(form.deliveryRadiusMeters, 10) || 5000,
          maxDeliveryRadiusMeters: parseInt(form.maxDeliveryRadiusMeters, 10) || 10000,
          deliveryFeePerKm: parseFloat(form.deliveryFeePerKm) || 0,
        },
        operatingHours,
        ...(timezoneDirty ? { timezone: form.timezone.trim() } : !isEdit ? { timezone: form.timezone.trim() } : {}),
        ...(deliveringDirty ? { is_currently_delivering: !!form.isCurrentlyDelivering, isCurrentlyDelivering: !!form.isCurrentlyDelivering } : {}),
        ...(slotDirty ? { next_available_slot: form.nextAvailableSlot ? new Date(form.nextAvailableSlot).toISOString() : null } : {}),
        ...(specialHoursDirty ? { specialHours: specialHoursParsed } : {}),
        ...(deliveryHoursDirty ? { delivery_hours: deliveryHoursParsed, deliveryHours: deliveryHoursParsed } : {}),
        ...(serviceAreaDirty ? { service_area: serviceAreaParsed } : {}),
        ...(priorityZonesDirty ? { priority_zones: priorityZonesParsed } : {}),
        ...(restrictedAreasDirty ? { restricted_areas: restrictedAreasParsed } : {}),
        ...(deliveryZonesDirty ? { delivery_zones: deliveryZonesParsed, deliveryZones: deliveryZonesParsed } : {}),
        ...(larDirty ? { location_accuracy_radius: form.locationAccuracyRadius.trim() ? Number(form.locationAccuracyRadius) : null } : {}),
        ...(peakDirty ? { peak_hours_multiplier: form.peakHoursMultiplier.trim() ? Number(form.peakHoursMultiplier) : null } : {}),
        ...(avgDirty ? { avg_delivery_time_minutes: form.avgDeliveryTimeMinutes.trim() ? Number(form.avgDeliveryTimeMinutes) : null } : {}),
        // Active Address relationship ONLY (parity with CMS /admin/collections/merchants/:id).
        // Never send `address: {...}` manual object. Create: always link. Edit: link when changed.
        ...(!isEdit
          ? { activeAddress: Number(form.activeAddressId.trim()) }
          : (activeAddressDirty ? { activeAddress: Number(form.activeAddressId.trim()) } : {})),
        ...(mediaPayload && Object.keys(mediaPayload).length > 0 ? { media: mediaPayload } : {}),
      };

      const url = isEdit ? `/api/outlets/${(initial as OutletDoc).id}` : '/api/outlets';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || j.details || 'Request failed');

      const debugInfo: DebugLogInfo = {
        endpoint: `${method} ${url}`,
        method,
        payloadSent: payload,
        responseStatus: res.status,
        responseBody: j,
        timestamp: new Date().toLocaleTimeString(),
      };

      const updatedDoc = j.outlet || j.doc || null;
      if (updatedDoc) {
        // Sync local form from persisted doc (enterprise: trust server truth, not optimistic local)
        setForm((prev) => ({
          ...prev,
          outletName: updatedDoc.outletName ?? prev.outletName,
          outletCode: updatedDoc.outletCode ?? prev.outletCode,
          description: updatedDoc.description ?? prev.description,
          specialInstructions: updatedDoc.specialInstructions ?? prev.specialInstructions,
          tagsText: Array.isArray(updatedDoc.tags) ? updatedDoc.tags.join(', ') : prev.tagsText,
          isActive: updatedDoc.isActive ?? prev.isActive,
          isAcceptingOrders: updatedDoc.isAcceptingOrders ?? prev.isAcceptingOrders,
          isCurrentlyDelivering: (updatedDoc as any).is_currently_delivering ?? (updatedDoc as any).isCurrentlyDelivering ?? prev.isCurrentlyDelivering,
          operationalStatus: updatedDoc.operationalStatus ?? prev.operationalStatus,
          timezone: (updatedDoc as any).timezone ?? prev.timezone,
          activeAddressId: getInitialActiveAddressId(updatedDoc as OutletDoc),
          locationAccuracyRadius: (updatedDoc as any).location_accuracy_radius != null ? String((updatedDoc as any).location_accuracy_radius) : prev.locationAccuracyRadius,
          peakHoursMultiplier: (updatedDoc as any).peak_hours_multiplier != null ? String((updatedDoc as any).peak_hours_multiplier) : prev.peakHoursMultiplier,
          avgDeliveryTimeMinutes: (updatedDoc as any).avg_delivery_time_minutes != null ? String((updatedDoc as any).avg_delivery_time_minutes) : prev.avgDeliveryTimeMinutes,
          phone: updatedDoc.contactInfo?.phone ?? prev.phone,
          email: updatedDoc.contactInfo?.email ?? prev.email,
          managerName: updatedDoc.contactInfo?.managerName ?? prev.managerName,
          managerPhone: updatedDoc.contactInfo?.managerPhone ?? prev.managerPhone,
          specialHoursText: (updatedDoc as any).specialHours != null ? toJsonText((updatedDoc as any).specialHours) : prev.specialHoursText,
          deliveryHoursText: (updatedDoc as any).delivery_hours != null ? toJsonText((updatedDoc as any).delivery_hours) : (updatedDoc as any).deliveryHours != null ? toJsonText((updatedDoc as any).deliveryHours) : prev.deliveryHoursText,
          nextAvailableSlot: (updatedDoc as any).next_available_slot ? isoToLocal((updatedDoc as any).next_available_slot) : prev.nextAvailableSlot,
          serviceAreaText: (updatedDoc as any).service_area != null ? toJsonText((updatedDoc as any).service_area) : prev.serviceAreaText,
          priorityZonesText: (updatedDoc as any).priority_zones != null ? toJsonText((updatedDoc as any).priority_zones) : prev.priorityZonesText,
          restrictedAreasText: (updatedDoc as any).restricted_areas != null ? toJsonText((updatedDoc as any).restricted_areas) : prev.restrictedAreasText,
          deliveryZonesText: (updatedDoc as any).delivery_zones != null ? toJsonText((updatedDoc as any).delivery_zones) : prev.deliveryZonesText,
          minimumOrderAmount: String(updatedDoc.deliverySettings?.minimumOrderAmount ?? prev.minimumOrderAmount),
          deliveryFee: String(updatedDoc.deliverySettings?.deliveryFee ?? prev.deliveryFee),
          freeDeliveryThreshold: String(updatedDoc.deliverySettings?.freeDeliveryThreshold ?? prev.freeDeliveryThreshold),
          estimatedDeliveryTimeMinutes: String(updatedDoc.deliverySettings?.estimatedDeliveryTimeMinutes ?? prev.estimatedDeliveryTimeMinutes),
          maxDeliveryTimeMinutes: String(updatedDoc.deliverySettings?.maxDeliveryTimeMinutes ?? prev.maxDeliveryTimeMinutes),
          deliveryRadiusMeters: String(updatedDoc.deliverySettings?.deliveryRadiusMeters ?? prev.deliveryRadiusMeters),
          maxDeliveryRadiusMeters: String(updatedDoc.deliverySettings?.maxDeliveryRadiusMeters ?? prev.maxDeliveryRadiusMeters),
          deliveryFeePerKm: String(updatedDoc.deliverySettings?.deliveryFeePerKm ?? prev.deliveryFeePerKm),
        }));
        if (updatedDoc.media?.thumbnail?.id != null) setThumbnailId(updatedDoc.media.thumbnail.id as number)
        if (updatedDoc.media?.storeFrontImage?.id != null) setStoreFrontImageId(updatedDoc.media.storeFrontImage.id as number)
        if ((updatedDoc.media as any)?.interiorImages) setInteriorIds(extractMediaIds((updatedDoc.media as any).interiorImages))
        if ((updatedDoc.media as any)?.menuImages) setMenuIds(extractMediaIds((updatedDoc.media as any).menuImages))
      }
      onSuccess(updatedDoc, debugInfo);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

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
  );

  return (
    <div className="bg-white dark:bg-[#171717] rounded-xl border border-gray-200 dark:border-[#262626] shadow-sm overflow-hidden">
      <div className="p-6 space-y-6">
        {error && <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}</div>}

        {/* 1. General */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Building2 className="w-4 h-4 text-[#eba236]" /> Outlet identity</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className={labelCls}>Outlet name *</label><input value={form.outletName} onChange={(e) => set('outletName', e.target.value)} placeholder="GMK CAFE — Bonifacio High Street" className={inputCls} /></div>
            <div><label className={labelCls}>Outlet code</label><input value={form.outletCode} onChange={(e) => set('outletCode', e.target.value)} placeholder="GMK-BGC-001 (auto if empty)" className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}><Globe className="w-3 h-3 inline mr-1" /> Timezone *</label><select value={form.timezone} onChange={(e) => set('timezone', e.target.value)} className={`${inputCls} font-mono`}>{TIMEZONES.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}</select><p className="text-xs text-gray-400 mt-1">IANA identifier</p></div>
            <div><label className={labelCls}>Operational status *</label>
              <select value={form.operationalStatus} onChange={(e) => set('operationalStatus', e.target.value)} className={inputCls}>
                <option value="open">Open</option>
                <option value="busy">Busy</option>
                <option value="temp_closed">Temporarily Closed</option>
                <option value="closed">Closed</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </div>
            <div className="sm:col-span-2"><label className={labelCls}>Description</label><textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="Short description for customers" className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}>Special instructions</label><textarea value={form.specialInstructions} onChange={(e) => set('specialInstructions', e.target.value)} rows={2} placeholder="Delivery / pickup instructions for riders" className={inputCls} /></div>
            <div className="sm:col-span-2"><label className={labelCls}><Tag className="w-3 h-3 inline mr-1" /> Tags (comma separated)</label><input value={form.tagsText} onChange={(e) => set('tagsText', e.target.value)} placeholder="flagship, mall, 24h" className={inputCls} /></div>
            {(initial as any)?.merchant_categories && Array.isArray((initial as any).merchant_categories) && (initial as any).merchant_categories.length > 0 && (
              <div className="sm:col-span-2">
                <label className={labelCls}>Merchant categories (read-only)</label>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(initial as any).merchant_categories.map((c:any)=> {
                    const name = typeof c === 'object' ? c.name : String(c);
                    const id = typeof c === 'object' ? c.id : c;
                    return <span key={String(id)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-[#262626] text-gray-700 dark:text-[#a1a1aa] border border-gray-200 dark:border-[#333]"><Tag className="w-3 h-3" />{name} <span className="text-xs text-gray-400">#{id}</span></span>
                  })}
                </div>
                <p className="text-xs text-gray-400 mt-1">Categories are managed by admin.</p>
              </div>
            )}
            <div className="flex items-center gap-6 pt-2 sm:col-span-2 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Active branch</span></label>
              <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.isAcceptingOrders} onChange={(e) => set('isAcceptingOrders', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Accepting orders</span></label>
              <label className="flex items-center gap-2 cursor-pointer" title="Quick pause — when off, outlet shows as not delivering even if status is open"><input type="checkbox" checked={!!form.isCurrentlyDelivering} onChange={(e) => set('isCurrentlyDelivering', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-emerald-600" /> <span className="text-sm font-medium text-gray-700 dark:text-white">Currently delivering</span></label>
            </div>
            <div className="sm:col-span-2"><label className={labelCls}><Timer className="w-3 h-3 inline mr-1" /> Next available slot</label><input type="datetime-local" value={form.nextAvailableSlot} onChange={(e) => set('nextAvailableSlot', e.target.value)} className={inputCls} /><p className="text-xs text-gray-400 mt-1">Maps to next_available_slot (ISO). Leave blank for null.</p></div>
          </div>
        </div>

        {/* 2. Media & Branding */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><ImageIcon className="w-4 h-4 text-[#eba236]" /> Media & Branding</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Outlet Thumbnail</label>
              <MediaUploader value={thumbnailId} onChange={(id) => setThumbnailId(id)} accept="image/*" className="mt-1" />
            </div>
            <div>
              <label className={labelCls}>Storefront Photo</label>
              <MediaUploader value={storeFrontImageId} onChange={(id) => setStoreFrontImageId(id)} accept="image/*" className="mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <MediaArraySection title="Interior images (media.interiorImages)" ids={interiorIds} setIds={setInteriorIds} />
            <MediaArraySection title="Menu images (media.menuImages)" ids={menuIds} setIds={setMenuIds} />
          </div>
          <p className="text-xs text-gray-400 mt-2">Arrays stored as JSON via media group. Use Add image to upload.</p>
        </div>

        {/* 3. Active Address — simple dropdown of vendor-owned addresses. No manual inputs. */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-[#eba236]" /> Active Address *</h4>
          <div>
            <label className={labelCls}>Active Address</label>
            <ActiveAddressDropdown
              value={form.activeAddressId}
              options={vendorAddresses}
              loading={addressesLoading}
              error={addressesError}
              onChange={(v) => set('activeAddressId', v)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div><label className={labelCls}>Location accuracy radius (m)</label><input type="number" min={0} value={form.locationAccuracyRadius} onChange={(e) => set('locationAccuracyRadius', e.target.value)} placeholder="50" className={`${inputCls} font-mono`} /></div>
          </div>
        </div>

        {/* 4. Contact */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Phone className="w-4 h-4 text-[#eba236]" /> Contact & manager</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Outlet email</label><input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="bgc@gmkcafe.ph" type="email" className={inputCls} /></div>
            <div><label className={labelCls}>Outlet phone</label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+63 917 123 4567" className={inputCls} /></div>
            <div><label className={labelCls}>Manager name</label><input value={form.managerName} onChange={(e) => set('managerName', e.target.value)} placeholder="Juan Dela Cruz" className={inputCls} /></div>
            <div><label className={labelCls}>Manager phone</label><input value={form.managerPhone} onChange={(e) => set('managerPhone', e.target.value)} placeholder="+63 917 765 4321" className={inputCls} /></div>
          </div>
        </div>

        {/* 5. Delivery */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Truck className="w-4 h-4 text-[#eba236]" /> Delivery & fulfillment</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Minimum order (₱)</label><input type="number" min={0} value={form.minimumOrderAmount} onChange={(e) => set('minimumOrderAmount', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Base delivery fee (₱)</label><input type="number" min={0} value={form.deliveryFee} onChange={(e) => set('deliveryFee', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Fee per km (₱)</label><input type="number" min={0} step={0.01} value={form.deliveryFeePerKm} onChange={(e) => set('deliveryFeePerKm', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Free delivery threshold (₱)</label><input type="number" min={0} value={form.freeDeliveryThreshold} onChange={(e) => set('freeDeliveryThreshold', e.target.value)} placeholder="0 = none" className={inputCls} /></div>
            <div><label className={labelCls}>Delivery radius (meters)</label><input type="number" min={0} value={form.deliveryRadiusMeters} onChange={(e) => set('deliveryRadiusMeters', e.target.value)} className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Max delivery radius (meters)</label><input type="number" min={0} value={form.maxDeliveryRadiusMeters} onChange={(e) => set('maxDeliveryRadiusMeters', e.target.value)} className={`${inputCls} font-mono`} /></div>
            <div><label className={labelCls}>Est. delivery time (min)</label><input type="number" min={5} max={120} value={form.estimatedDeliveryTimeMinutes} onChange={(e) => set('estimatedDeliveryTimeMinutes', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Max delivery time (min)</label><input type="number" min={10} max={180} value={form.maxDeliveryTimeMinutes} onChange={(e) => set('maxDeliveryTimeMinutes', e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}><Zap className="w-3 h-3 inline mr-1" /> Peak hours multiplier (≥1)</label><input type="number" min={1} step={0.1} value={form.peakHoursMultiplier} onChange={(e) => set('peakHoursMultiplier', e.target.value)} placeholder="1" className={inputCls} /><p className="text-xs text-gray-400 mt-1">Surge pricing during peak hours</p></div>
            <div><label className={labelCls}>Avg delivery time (min)</label><input type="number" min={0} value={form.avgDeliveryTimeMinutes} onChange={(e) => set('avgDeliveryTimeMinutes', e.target.value)} placeholder="25" className={inputCls} /></div>
          </div>
        </div>

        {/* 6. Hours */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-[#eba236]" /> Weekly operating hours</h4>
          <div className="rounded-xl border border-gray-200 dark:border-[#262626] divide-y divide-gray-100 dark:divide-[#262626] overflow-hidden">
            {DAYS.map((day) => {
              const h = form.hours[day] || { open: '09:00', close: '21:00', closed: false };
              return (
                <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-4 py-2.5">
                  <span className="text-sm font-medium text-gray-900 dark:text-white w-24 shrink-0">{day}</span>
                  <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-[#a1a1aa] cursor-pointer shrink-0">
                    <input type="checkbox" checked={!!h.closed} onChange={(e) => setDay(day, 'closed', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#eba236]" /> Closed
                  </label>
                  <div className={`flex flex-col gap-2 ${h.closed ? 'opacity-40 pointer-events-none' : ''}`}>
                    {(h.periods || [{ open: h.open || '09:00', close: h.close || '21:00' }]).map((period, periodIndex) => (
                      <div key={`${day}-${periodIndex}`} className="flex items-center gap-2">
                        <input type="time" value={periodIndex === 0 ? h.open : period.open} onChange={(e) => periodIndex === 0 ? setDay(day, 'open', e.target.value) : setForm((prev) => ({ ...prev, hours: { ...prev.hours, [day]: { ...h, periods: (h.periods || [period]).map((p, i) => i === periodIndex ? { ...p, open: e.target.value } : p) } } }))} disabled={h.closed} className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm" />
                        <span className="text-gray-400">to</span>
                        <input type="time" value={periodIndex === 0 ? h.close : period.close} onChange={(e) => periodIndex === 0 ? setDay(day, 'close', e.target.value) : setForm((prev) => ({ ...prev, hours: { ...prev.hours, [day]: { ...h, periods: (h.periods || [period]).map((p, i) => i === periodIndex ? { ...p, close: e.target.value } : p) } } }))} disabled={h.closed} className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-[#262626] bg-white dark:bg-[#0a0a0a] text-sm" />
                        {periodIndex > 0 && <button type="button" onClick={() => removePeriod(day, periodIndex)} disabled={h.closed} className="text-xs text-red-600 hover:underline">Remove</button>}
                      </div>
                    ))}
                    <button type="button" onClick={() => addPeriod(day)} disabled={h.closed} className="self-start text-xs font-medium text-[#b97810] hover:underline">Add period</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 7. Special hours & Delivery hours JSON */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-600" /> Special hours & Delivery hours (JSON)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>specialHours (JSON array: date, openTime, closeTime, isClosed, reason)</label>
              <textarea value={form.specialHoursText} onChange={(e) => set('specialHoursText', e.target.value)} rows={5} placeholder='[ { "date": "2026-12-25", "isClosed": true, "reason": "Christmas" } ]' className={textareaCls} />
            </div>
            <div>
              <label className={labelCls}>delivery_hours (JSON)</label>
              <textarea value={form.deliveryHoursText} onChange={(e) => set('deliveryHoursText', e.target.value)} rows={5} placeholder='{"monday": {"open":"09:00","close":"21:00"}} or null' className={textareaCls} />
              <p className="text-xs text-gray-400 mt-1">Alias: delivery_hours persists separately from operatingHours</p>
            </div>
          </div>
        </div>

        {/* 8. Service & Delivery Zones (GeoJSON) */}
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-600" /> Service & Delivery Zones (GeoJSON)</h4>
          <p className="text-xs text-gray-500 mb-3">Editable GeoJSON; read-only *_geometry fields are auto-derived in CMS. Use valid GeoJSON (Polygon/MultiPolygon). Leave blank for null.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>service_area (GeoJSON Polygon)</label><textarea value={form.serviceAreaText} onChange={(e) => set('serviceAreaText', e.target.value)} rows={4} placeholder='{"type":"Polygon","coordinates":[[[121,14],[121.1,14],[121.1,14.1],[121,14.1],[121,14]]]}' className={textareaCls} /></div>
            <div><label className={labelCls}>priority_zones (MultiPolygon)</label><textarea value={form.priorityZonesText} onChange={(e) => set('priorityZonesText', e.target.value)} rows={4} placeholder='{"type":"MultiPolygon","coordinates":[...]}' className={textareaCls} /></div>
            <div><label className={labelCls}>restricted_areas (MultiPolygon)</label><textarea value={form.restrictedAreasText} onChange={(e) => set('restrictedAreasText', e.target.value)} rows={4} placeholder='{"type":"MultiPolygon","coordinates":[...]}' className={textareaCls} /></div>
            <div><label className={labelCls}>delivery_zones (zone pricing JSONB)</label><textarea value={form.deliveryZonesText} onChange={(e) => set('deliveryZonesText', e.target.value)} rows={4} placeholder='[{"zone":"A","fee":50,"polygon":{...}}]' className={textareaCls} /></div>
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
  );
}
